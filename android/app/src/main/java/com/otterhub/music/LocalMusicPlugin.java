package com.otterhub.music;

import android.Manifest;
import android.app.Activity;
import android.app.RecoverableSecurityException;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.IntentSender;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.database.Cursor;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import java.io.File;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "LocalMusicPlugin", permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE }),
        @Permission(alias = "audio", strings = { Manifest.permission.READ_MEDIA_AUDIO })
})
public class LocalMusicPlugin extends Plugin {

    private static final String PERMISSION_ALIAS = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "audio" : "storage";
    private static final String[] AUDIO_EXTENSIONS = {".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".wma", ".ape", ".opus", ".m4b", ".m4s"};

    private final ExecutorService scanExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService ioExecutor = Executors.newFixedThreadPool(Runtime.getRuntime().availableProcessors());
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile boolean isScanning = false;
    private PluginCall pendingDeleteCall;
    private String pendingDeletePath;
    private static final int DELETE_PERMISSION_REQUEST = 0x7A33;
    private static final String EXCLUDED_PREFS = "LocalMusicExcluded";
    private static final String EXCLUDED_FOLDERS_KEY = "excluded_folders";
    private static final String SEPARATOR = "\u001F";

    private static final String SCHEME_CONTENT = "content://";
    private static final String[] PROJECTION_MUSIC = {
            MediaStore.Audio.Media._ID, MediaStore.Audio.Media.TITLE, MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM, MediaStore.Audio.Media.DURATION, MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.DATE_MODIFIED
    };


    // --- 核心扫描方法 ---

    @PluginMethod
    public void scanLocalMusic(PluginCall call) {
        if (hasRequiredPermission()) scanMusicFiles(call);
        else requestPermissionForAlias(PERMISSION_ALIAS, call, "handlePermissionResult");
    }


    // --- 权限与设置 ---




    // --- 目录选择回调 ---


    @PermissionCallback
    private void handlePermissionResult(PluginCall call) {
        if (hasRequiredPermission()) scanMusicFiles(call); else resolveError(call, "Permission denied");
    }


    private boolean hasRequiredPermission() {
        return getPermissionState(PERMISSION_ALIAS) == PermissionState.GRANTED;
    }

    @PluginMethod
    public void getSystemDarkMode(PluginCall call) {
        int nightModeFlags = getContext().getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        boolean isDarkMode = nightModeFlags == Configuration.UI_MODE_NIGHT_YES;
        call.resolve(new JSObject().put("isDarkMode", isDarkMode));
    }

    public void notifyDarkModeChange(boolean isDarkMode) {
        notifyListeners("darkModeChange", new JSObject().put("isDarkMode", isDarkMode));
    }

    // --- 内部扫描逻辑 ---

    private void scanMusicFiles(PluginCall call) {
        if (isScanning) {
            resolveError(call, "扫描正在进行中");
            return;
        }
        isScanning = true;
        scanExecutor.execute(() -> {
            try {
                JSObject result = performMediaStoreScan();
                mainHandler.post(() -> call.resolve(result));
            } catch (Exception e) {
                mainHandler.post(() -> resolveError(call, "Scan failed: " + e.getMessage()));
            } finally {
                isScanning = false;
            }
        });
    }

    private JSObject performMediaStoreScan() {
        JSArray filesArray = new JSArray();
        ContentResolver resolver = getContext().getContentResolver();
        Uri musicUri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;

        try (Cursor cursor = resolver.query(musicUri, PROJECTION_MUSIC, buildMediaStoreMusicSelection(), null, MediaStore.Audio.Media.DATE_MODIFIED + " DESC")) {
            if (cursor != null && cursor.moveToFirst()) {
                int idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                int titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                int artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                int albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
                int durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE);
                int modifiedCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_MODIFIED);

                do {
                    long id = cursor.getLong(idCol);
                    filesArray.put(new JSObject()
                            .put("id", String.valueOf(id))
                            .put("name", formatUnknown(cursor.getString(titleCol)))
                            .put("artist", formatUnknown(cursor.getString(artistCol)))
                            .put("album", formatUnknown(cursor.getString(albumCol)))
                            .put("duration", cursor.getLong(durationCol))
                            .put("localPath", ContentUris.withAppendedId(musicUri, id).toString())
                            .put("fileSize", cursor.getLong(sizeCol))
                            .put("modifiedTime", cursor.getLong(modifiedCol) * 1000));
                } while (cursor.moveToNext());
            }
        } catch (Exception e) {
            return new JSObject().put("success", false).put("error", "Failed: " + e.getMessage()).put("files", new JSArray());
        }
        return new JSObject().put("success", true).put("files", filesArray);
    }

    /** 构建保守的 MediaStore 音乐过滤条件，优先用系统用途元数据避免关键词误伤。 */
    private String buildMediaStoreMusicSelection() {
        String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            selection += " AND " + MediaStore.Audio.Media.IS_RECORDING + " = 0"
                    + " AND " + MediaStore.Audio.Media.IS_PODCAST + " = 0"
                    + " AND " + MediaStore.Audio.Media.IS_RINGTONE + " = 0"
                    + " AND " + MediaStore.Audio.Media.IS_ALARM + " = 0"
                    + " AND " + MediaStore.Audio.Media.IS_NOTIFICATION + " = 0";
        }
        return selection;
    }




    // --- 文件操作 ---

    @PluginMethod
    public void getLocalFileUrl(PluginCall call) {
        String localPath = call.getString("localPath");
        if (!isValid(localPath)) {
            resolveError(call, "localPath is required");
            return;
        }
        if (localPath.startsWith(SCHEME_CONTENT)) {
            resolveSuccess(call, "url", localPath);
            return;
        }
        File file = new File(localPath);
        if (!file.exists()) resolveError(call, "File not found");
        else resolveSuccess(call, "url", Uri.fromFile(file).toString());
    }

    /** 读取音频文件内嵌封面，返回可直接用于 img.src 的 data URL。 */
    @PluginMethod
    public void getEmbeddedCover(PluginCall call) {
        String localPath = call.getString("localPath");
        if (!isValid(localPath)) {
            resolveError(call, "localPath is required");
            return;
        }

        ioExecutor.execute(() -> {
            try (MediaMetadataRetriever retriever = new MediaMetadataRetriever()) {
                setRetrieverDataSource(retriever, localPath);
                byte[] picture = retriever.getEmbeddedPicture();
                if (picture == null || picture.length == 0) {
                    mainHandler.post(() -> resolveError(call, "No embedded cover"));
                    return;
                }

                String mimeType = detectImageMimeType(picture);
                String base64 = Base64.encodeToString(picture, Base64.NO_WRAP);
                JSObject result = new JSObject()
                        .put("success", true)
                        .put("dataUrl", "data:" + mimeType + ";base64," + base64);
                mainHandler.post(() -> call.resolve(result));
            } catch (Exception e) {
                mainHandler.post(() -> resolveError(call, "Failed: " + e.getMessage()));
            }
        });
    }

    /** 读取 MP3 ID3v2 USLT 非同步歌词帧。 */
    @PluginMethod
    public void getEmbeddedLyrics(PluginCall call) {
        String localPath = call.getString("localPath");
        if (!isValid(localPath)) {
            resolveError(call, "localPath is required");
            return;
        }

        ioExecutor.execute(() -> {
            try {
                String[] parts = extractUsltLyrics(localPath);
                if (parts == null || !isValid(parts[0])) {
                    mainHandler.post(() -> resolveError(call, "No embedded lyrics"));
                    return;
                }

                JSObject result = new JSObject()
                        .put("success", true)
                        .put("lyric", parts[0]);
                if (parts.length > 1 && parts[1] != null) {
                    result.put("tlyric", parts[1]);
                }
                mainHandler.post(() -> call.resolve(result));
            } catch (Exception e) {
                mainHandler.post(() -> resolveError(call, "Failed: " + e.getMessage()));
            }
        });
    }

    @PluginMethod
    public void deleteLocalMusic(PluginCall call) {
        String localPath = call.getString("localPath");
        if (!isValid(localPath)) {
            resolveError(call, "localPath is required");
            return;
        }

        try {
            if (performDeleteFile(localPath)) resolveSuccess(call, null, null);
            else resolveError(call, "Failed to delete file");
        } catch (SecurityException e) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                handleRecoverableDelete(call, localPath, e);
            } else {
                resolveError(call, "Error: " + e.getMessage());
            }
        } catch (Exception e) {
            resolveError(call, "Error: " + e.getMessage());
        }
    }

    private void handleRecoverableDelete(PluginCall call, String localPath, SecurityException e) {
        if (!(e instanceof RecoverableSecurityException)) {
            resolveError(call, "Delete failed: " + e.getMessage());
            return;
        }
        try {
            RecoverableSecurityException rse = (RecoverableSecurityException) e;
            pendingDeleteCall = call;
            pendingDeletePath = localPath;
            IntentSender sender = rse.getUserAction().getActionIntent().getIntentSender();
            getActivity().startIntentSenderForResult(sender, DELETE_PERMISSION_REQUEST, null, 0, 0, 0);
        } catch (IntentSender.SendIntentException ex) {
            pendingDeleteCall = null;
            pendingDeletePath = null;
            resolveError(call, "Failed to request delete: " + ex.getMessage());
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != DELETE_PERMISSION_REQUEST || pendingDeleteCall == null) return;

        if (resultCode == Activity.RESULT_OK) {
            retryDelete(pendingDeleteCall, pendingDeletePath);
        } else {
            resolveError(pendingDeleteCall, "Delete cancelled by user");
        }
        pendingDeleteCall = null;
        pendingDeletePath = null;
    }

    @Override
    protected void handleOnDestroy() {
        if (scanExecutor != null && !scanExecutor.isShutdown()) scanExecutor.shutdownNow();
        if (ioExecutor != null && !ioExecutor.isShutdown()) ioExecutor.shutdownNow();
        super.handleOnDestroy();
    }

    private void retryDelete(PluginCall call, String localPath) {
        try {
            if (performDeleteFile(localPath)) resolveSuccess(call, null, null);
            else resolveError(call, "Failed to delete file");
        } catch (SecurityException e) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && e instanceof RecoverableSecurityException) {
                handleRecoverableDelete(call, localPath, e);
            } else {
                resolveError(call, "Error: " + e.getMessage());
            }
        } catch (Exception e) {
            resolveError(call, "Error: " + e.getMessage());
        }
    }

    private boolean performDeleteFile(String localPath) {
        ContentResolver resolver = getContext().getContentResolver();
        boolean deleted = false;

        if (localPath.startsWith(SCHEME_CONTENT)) {
            deleted = tryDelete(() -> resolver.delete(Uri.parse(localPath), null, null) > 0);
        }
        if (!deleted) {
            deleted = tryDelete(() -> resolver.delete(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, MediaStore.Audio.Media.DATA + "=?", new String[]{localPath}) > 0);
        }
        if (!deleted) {
            File file = new File(localPath);
            deleted = !file.exists() || file.delete();
        }
        return deleted;
    }

    // --- 工具辅助方法 ---


    // --- 排除目录管理 ---










    /** 将 file:// URI 或普通文件路径解析为纯文件系统路径。 */
    private String resolvePlainPath(String localPath) {
        if (localPath.startsWith("file://")) {
            String path = Uri.parse(localPath).getPath();
            return path != null ? path : localPath;
        }
        return localPath;
    }

    /** 为普通文件路径、file URI 和 content URI 设置 MediaMetadataRetriever 数据源。 */
    private void setRetrieverDataSource(MediaMetadataRetriever retriever, String localPath) {
        if (localPath.startsWith(SCHEME_CONTENT)) {
            retriever.setDataSource(getContext(), Uri.parse(localPath));
            return;
        }
        String path = resolvePlainPath(localPath);
        File file = new File(path);
        if (!file.exists()) {
            throw new RuntimeException("File not found: " + path);
        }
        try (FileInputStream fis = new FileInputStream(file)) {
            retriever.setDataSource(fis.getFD());
        } catch (IOException e) {
            try {
                retriever.setDataSource(path);
            } catch (Exception ex) {
                throw new RuntimeException("Cannot open file: " + path, e);
            }
        }
    }

    /** 根据图片魔数识别常见封面 MIME 类型。 */
    private String detectImageMimeType(byte[] data) {
        if (data.length >= 8
                && data[0] == (byte) 0x89
                && data[1] == 0x50
                && data[2] == 0x4E
                && data[3] == 0x47) {
            return "image/png";
        }
        if (data.length >= 12
                && data[0] == 0x52
                && data[1] == 0x49
                && data[2] == 0x46
                && data[3] == 0x46
                && data[8] == 0x57
                && data[9] == 0x45
                && data[10] == 0x42
                && data[11] == 0x50) {
            return "image/webp";
        }
        return "image/jpeg";
    }

    /** 原文与译文的分隔标记，与 id3-embed.ts 中的 TLYRIC_DELIMITER 对应。 */
    private static final String TLYRIC_DELIMITER = "[TLYRIC]";

    /** 从 ID3v2 tag 中提取首个 USLT 歌词帧，按分隔符拆分为 [lyric, tlyric]。 */
    private String[] extractUsltLyrics(String localPath) throws IOException {
        try (InputStream input = openLocalInputStream(localPath)) {
            if (input == null) return null;

            byte[] header = readExact(input, 10);
            if (header == null || header[0] != 'I' || header[1] != 'D' || header[2] != '3') return null;

            int majorVersion = header[3] & 0xFF;
            int tagSize = readSynchsafeInt(header, 6);
            if (tagSize <= 0 || tagSize > 5 * 1024 * 1024) return null;

            byte[] tag = readExact(input, tagSize);
            if (tag == null) return null;

            int offset = skipExtendedHeaderIfNeeded(tag, majorVersion, header[5] & 0xFF);
            while (offset + 10 <= tag.length) {
                String frameId = new String(tag, offset, 4, StandardCharsets.ISO_8859_1);
                if (frameId.trim().isEmpty()) break;

                int frameSize = majorVersion >= 4
                        ? readSynchsafeInt(tag, offset + 4)
                        : readInt(tag, offset + 4);
                if (frameSize <= 0 || offset + 10 + frameSize > tag.length) break;

                if ("USLT".equals(frameId)) {
                    String lyric = decodeUsltFrame(Arrays.copyOfRange(tag, offset + 10, offset + 10 + frameSize));
                    if (!isValid(lyric)) return null;

                    int delimIdx = lyric.indexOf(TLYRIC_DELIMITER);
                    if (delimIdx >= 0) {
                        String original = lyric.substring(0, delimIdx).trim();
                        String translation = lyric.substring(delimIdx + TLYRIC_DELIMITER.length()).trim();
                        return new String[]{ original, isValid(translation) ? translation : null };
                    }
                    return new String[]{ lyric, null };
                }

                offset += 10 + frameSize;
            }
        }
        return null;
    }

    /** 打开普通文件路径、file URI 或 content URI 对应的输入流。 */
    private InputStream openLocalInputStream(String localPath) throws IOException {
        if (localPath.startsWith(SCHEME_CONTENT)) {
            return getContext().getContentResolver().openInputStream(Uri.parse(localPath));
        }
        String path = resolvePlainPath(localPath);
        return new FileInputStream(path);
    }

    /** 读取指定长度字节；流提前结束时返回 null。 */
    private byte[] readExact(InputStream input, int length) throws IOException {
        byte[] data = new byte[length];
        int offset = 0;
        while (offset < length) {
            int read = input.read(data, offset, length - offset);
            if (read < 0) return null;
            offset += read;
        }
        return data;
    }

    /** 读取 ID3 synchsafe 整数。 */
    private int readSynchsafeInt(byte[] data, int offset) {
        return ((data[offset] & 0x7F) << 21)
                | ((data[offset + 1] & 0x7F) << 14)
                | ((data[offset + 2] & 0x7F) << 7)
                | (data[offset + 3] & 0x7F);
    }

    /** 读取大端 32 位整数。 */
    private int readInt(byte[] data, int offset) {
        return ((data[offset] & 0xFF) << 24)
                | ((data[offset + 1] & 0xFF) << 16)
                | ((data[offset + 2] & 0xFF) << 8)
                | (data[offset + 3] & 0xFF);
    }

    /** 跳过 ID3v2 扩展头，返回首个 frame offset。 */
    private int skipExtendedHeaderIfNeeded(byte[] tag, int majorVersion, int flags) {
        if ((flags & 0x40) == 0 || tag.length < 4) return 0;

        int size = majorVersion >= 4 ? readSynchsafeInt(tag, 0) : readInt(tag, 0);
        if (size < 0 || size > tag.length) return 0;
        return majorVersion >= 4 ? size : size + 4;
    }

    /** 解码 USLT 帧正文，去除编码、语言和描述字段。 */
    private String decodeUsltFrame(byte[] frame) {
        if (frame.length < 5) return null;

        int encoding = frame[0] & 0xFF;
        Charset charset = getId3Charset(encoding);
        int offset = 4;
        int textStart = findTextStartAfterDescription(frame, offset, encoding);
        if (textStart < 0 || textStart >= frame.length) return null;

        byte[] textBytes = Arrays.copyOfRange(frame, textStart, frame.length);
        return new String(textBytes, charset).replace("\u0000", "").trim();
    }

    /** 获取 ID3 文本编码。 */
    private Charset getId3Charset(int encoding) {
        if (encoding == 1) return StandardCharsets.UTF_16;
        if (encoding == 2) return StandardCharsets.UTF_16BE;
        if (encoding == 3) return StandardCharsets.UTF_8;
        return StandardCharsets.ISO_8859_1;
    }

    /** 定位 USLT 描述字段后的歌词正文起点。 */
    private int findTextStartAfterDescription(byte[] frame, int offset, int encoding) {
        if (encoding == 1 || encoding == 2) {
            for (int i = offset; i + 1 < frame.length; i += 2) {
                if (frame[i] == 0 && frame[i + 1] == 0) return i + 2;
            }
            return -1;
        }

        for (int i = offset; i < frame.length; i++) {
            if (frame[i] == 0) return i + 1;
        }
        return -1;
    }


    private String[] parseFileName(String fileName) {
        if (!isValid(fileName)) return new String[]{"未知歌曲", null};
        int dot = fileName.lastIndexOf('.');
        String name = dot > 0 ? fileName.substring(0, dot) : fileName;
        int dash = name.lastIndexOf(" - ");
        return dash > 0 && dash < name.length() - 3 
                ? new String[]{name.substring(0, dash).trim(), name.substring(dash + 3).trim()} 
                : new String[]{name.trim(), null};
    }



    private String formatUnknown(String value) {
        return (value == null || value.isEmpty() || "<unknown>".equals(value)) ? null : value;
    }

    private boolean isValid(String s) {
        return s != null && !s.isEmpty() && !"<unknown>".equals(s) && !"未知歌曲".equals(s);
    }

    private void resolveSuccess(PluginCall call, String key, Object value) {
        JSObject res = new JSObject().put("success", true);
        if (key != null) res.put(key, value);
        call.resolve(res);
    }

    private void resolveError(PluginCall call, String msg) {
        call.resolve(new JSObject().put("success", false).put("error", msg).put("files", new JSArray()));
    }

    private boolean tryDelete(DeleteAction action) {
        try { return action.execute(); } catch (Exception e) { return false; }
    }

    private interface DeleteAction { boolean execute() throws Exception; }
}
