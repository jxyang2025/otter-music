"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const PRIVACY_CONSENT_KEY = "otter_music_privacy_consent";

export function PrivacyConsentDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const consent = localStorage.getItem(PRIVACY_CONSENT_KEY);
    if (!consent) {
      setOpen(true);
    }
  }, []);

  const handleAgree = () => {
    localStorage.setItem(PRIVACY_CONSENT_KEY, "true");
    setOpen(false);
  };

  const handleDisagree = () => {
    // On native, minimize the app; on web, just close
    if (typeof (window as any).Capacitor !== "undefined") {
      try {
        (window as any).Capacitor.Plugins.App.exitApp();
      } catch {
        setOpen(false);
      }
    } else {
      // In web, show a message but allow continuing
      localStorage.setItem(PRIVACY_CONSENT_KEY, "true");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="text-center">隐私政策</DialogTitle>
          <DialogDescription className="text-center pt-2">
            请阅读并同意我们的隐私政策以继续使用
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground space-y-2 py-2">
          <p>
            我们重视您的隐私。本应用仅会：
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>扫描您设备上的音频文件以构建本地音乐库</li>
            <li>保存您的播放列表和收藏到本地</li>
            <li>仅在您登录时保存第三方平台凭据在本地</li>
          </ul>
          <p>
            我们不会收集、上传或共享您的个人数据。
          </p>
          <p>
            点击"同意"即表示您已阅读并同意我们的隐私政策。
          </p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleAgree} className="w-full">
            同意并继续使用
          </Button>
          <Button onClick={handleDisagree} variant="ghost" className="w-full text-xs">
            不同意
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
