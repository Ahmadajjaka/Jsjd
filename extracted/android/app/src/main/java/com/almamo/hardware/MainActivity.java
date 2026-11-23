package com.almamo.hardware;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Dialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 4401;
    private Dialog oauthPopupDialog;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeGoogleAuthPlugin.class);
        registerPlugin(NativeKeyboardPlugin.class);
        super.onCreate(savedInstanceState);
        if (getWindow() != null) {
            getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        }
        configureWebViewForFirebaseAndOffline(true);
        requestEssentialRuntimePermissions();
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebViewForFirebaseAndOffline(false);
    }

    @Override
    public void onDestroy() {
        dismissOAuthPopupDialog();
        super.onDestroy();
    }

    private String buildCleanChromeUserAgent(String rawUa) {
        if (rawUa == null || rawUa.isEmpty()) {
            return "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
        }
        // Strip Android WebView '; wv' marker & 'Version/4.0' so Google OAuth allows sign-in without 403 disallowed_useragent
        return rawUa
                .replace("; wv)", ")")
                .replace("wv;", "")
                .replaceAll("Version/\\d+\\.\\d+\\s*", "");
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebViewForFirebaseAndOffline(boolean attachChromeClient) {
        if (this.bridge == null || this.bridge.getWebView() == null) {
            return;
        }
        WebView webView = this.bridge.getWebView();
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus();

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        WebSettings settings = webView.getSettings();
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setUserAgentString(buildCleanChromeUserAgent(settings.getUserAgentString()));

        if (attachChromeClient) {
            webView.setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
                @Override
                public boolean onCreateWindow(
                        WebView view,
                        boolean isDialog,
                        boolean isUserGesture,
                        Message resultMsg
                ) {
                    if (resultMsg == null || !(resultMsg.obj instanceof WebView.WebViewTransport)) {
                        return false;
                    }
                    openOAuthPopupDialog((WebView.WebViewTransport) resultMsg.obj, resultMsg);
                    return true;
                }

                @Override
                public void onCloseWindow(WebView window) {
                    dismissOAuthPopupDialog();
                    super.onCloseWindow(window);
                }
            });
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void openOAuthPopupDialog(WebView.WebViewTransport transport, Message resultMsg) {
        dismissOAuthPopupDialog();

        final WebView popupWebView = new WebView(this);
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(popupWebView, true);

        WebSettings popupSettings = popupWebView.getSettings();
        popupSettings.setJavaScriptEnabled(true);
        popupSettings.setDomStorageEnabled(true);
        popupSettings.setDatabaseEnabled(true);
        popupSettings.setJavaScriptCanOpenWindowsAutomatically(true);
        popupSettings.setSupportMultipleWindows(false);
        popupSettings.setUserAgentString(buildCleanChromeUserAgent(popupSettings.getUserAgentString()));

        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(Color.WHITE);
        container.addView(
                popupWebView,
                new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                )
        );

        Button closeBtn = new Button(this);
        closeBtn.setText("✕ إغلاق");
        closeBtn.setTextColor(Color.WHITE);
        closeBtn.setBackgroundColor(Color.parseColor("#CC0F172A"));
        closeBtn.setPadding(28, 12, 28, 12);
        FrameLayout.LayoutParams closeParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.TOP | Gravity.END
        );
        closeParams.setMargins(24, 36, 24, 24);
        closeBtn.setOnClickListener(v -> dismissOAuthPopupDialog());
        container.addView(closeBtn, closeParams);

        final Dialog dialog = new Dialog(this, android.R.style.Theme_DeviceDefault_Light_NoActionBar);
        dialog.setContentView(container);
        if (dialog.getWindow() != null) {
            dialog.getWindow().setLayout(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT
            );
        }

        popupWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return false;
                String scheme = uri.getScheme();
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        popupWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onCloseWindow(WebView window) {
                dismissOAuthPopupDialog();
            }
        });

        dialog.setOnDismissListener(d -> {
            popupWebView.stopLoading();
            popupWebView.destroy();
            if (oauthPopupDialog == dialog) {
                oauthPopupDialog = null;
            }
        });

        oauthPopupDialog = dialog;
        dialog.show();

        transport.setWebView(popupWebView);
        resultMsg.sendToTarget();
    }

    private void dismissOAuthPopupDialog() {
        if (oauthPopupDialog != null) {
            try {
                if (oauthPopupDialog.isShowing()) {
                    oauthPopupDialog.dismiss();
                }
            } catch (Exception ignored) {
            }
            oauthPopupDialog = null;
        }
    }

    private void requestEssentialRuntimePermissions() {
        List<String> needed = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES)
                    != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
        } else if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.S_V2) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
        }

        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(
                    this,
                    needed.toArray(new String[0]),
                    PERMISSION_REQUEST_CODE
            );
        }
    }
}
