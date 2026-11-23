package com.almamo.hardware;

import android.app.Activity;
import android.content.Context;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeKeyboard")
public class NativeKeyboardPlugin extends Plugin {

    @PluginMethod
    public void show(PluginCall call) {
        final Activity activity = getActivity();
        final WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (activity == null || webView == null) {
            call.resolve(new JSObject().put("shown", false));
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                webView.setFocusable(true);
                webView.setFocusableInTouchMode(true);
                webView.requestFocus(View.FOCUS_DOWN);

                InputMethodManager imm = (InputMethodManager) activity.getSystemService(Context.INPUT_METHOD_SERVICE);
                boolean shown = false;
                if (imm != null) {
                    shown = imm.showSoftInput(webView, InputMethodManager.SHOW_IMPLICIT);
                    if (!shown) {
                        imm.showSoftInput(webView, 0);
                        shown = true;
                    }
                }
                JSObject ret = new JSObject();
                ret.put("shown", shown);
                ret.put("nativeAndroid", true);
                call.resolve(ret);
            } catch (Exception ex) {
                JSObject ret = new JSObject();
                ret.put("shown", false);
                ret.put("error", ex.getMessage());
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void hide(PluginCall call) {
        final Activity activity = getActivity();
        final WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (activity == null || webView == null) {
            call.resolve(new JSObject().put("hidden", false));
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                InputMethodManager imm = (InputMethodManager) activity.getSystemService(Context.INPUT_METHOD_SERVICE);
                boolean hidden = false;
                if (imm != null && webView.getWindowToken() != null) {
                    hidden = imm.hideSoftInputFromWindow(webView.getWindowToken(), 0);
                }
                call.resolve(new JSObject().put("hidden", hidden));
            } catch (Exception ex) {
                call.resolve(new JSObject().put("hidden", false));
            }
        });
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        final Activity activity = getActivity();
        final WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (activity == null || webView == null) {
            call.resolve(new JSObject().put("isVisible", false).put("heightPx", 0).put("nativeAndroid", false));
            return;
        }

        activity.runOnUiThread(() -> {
            boolean isVisible = false;
            int heightPx = 0;
            try {
                WindowInsetsCompat rootInsets = ViewCompat.getRootWindowInsets(webView);
                if (rootInsets != null) {
                    isVisible = rootInsets.isVisible(WindowInsetsCompat.Type.ime());
                    Insets imeInsets = rootInsets.getInsets(WindowInsetsCompat.Type.ime());
                    heightPx = Math.max(0, imeInsets.bottom);
                }
            } catch (Exception ignored) {
            }
            JSObject ret = new JSObject();
            ret.put("isVisible", isVisible);
            ret.put("heightPx", heightPx);
            ret.put("nativeAndroid", true);
            call.resolve(ret);
        });
    }
}
