package com.almamo.hardware;

import android.app.Activity;
import android.content.Intent;
import android.os.CancellationSignal;
import androidx.activity.result.ActivityResult;
import androidx.annotation.NonNull;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.tasks.Task;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {

    private final Executor bgExecutor = Executors.newSingleThreadExecutor();

    private String resolveServerClientId(PluginCall call) {
        String passed = call != null ? call.getString("serverClientId") : null;
        if (passed != null && !passed.trim().isEmpty()) {
            return passed.trim();
        }
        return getContext().getString(R.string.default_web_client_id);
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable", "ACTIVITY_UNAVAILABLE");
            return;
        }

        final String serverClientId = resolveServerClientId(call);
        if (serverClientId == null || serverClientId.isEmpty()) {
            call.reject("Missing serverClientId", "MISSING_CLIENT_ID");
            return;
        }

        launchSignInWithGoogleOption(activity, call, serverClientId);
    }

    private void launchSignInWithGoogleOption(Activity activity, PluginCall call, String serverClientId) {
        try {
            CredentialManager credentialManager = CredentialManager.create(activity);
            GetSignInWithGoogleOption signInWithGoogleOption = new GetSignInWithGoogleOption.Builder(serverClientId)
                .build();

            GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(signInWithGoogleOption)
                .build();

            credentialManager.getCredentialAsync(
                activity,
                request,
                new CancellationSignal(),
                bgExecutor,
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(@NonNull GetCredentialResponse result) {
                        if (resolveGoogleCredentialResult(activity, call, result)) {
                            return;
                        }
                        activity.runOnUiThread(() -> launchGoogleIdOneTapOption(activity, call, serverClientId));
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException e) {
                        if (e instanceof GetCredentialCancellationException) {
                            activity.runOnUiThread(() -> call.reject("User cancelled Google Sign-In", "USER_CANCELED"));
                            return;
                        }
                        activity.runOnUiThread(() -> launchGoogleIdOneTapOption(activity, call, serverClientId));
                    }
                }
            );
        } catch (Exception ex) {
            launchGoogleIdOneTapOption(activity, call, serverClientId);
        }
    }

    private void launchGoogleIdOneTapOption(Activity activity, PluginCall call, String serverClientId) {
        try {
            CredentialManager credentialManager = CredentialManager.create(activity);
            GetGoogleIdOption googleIdOption = new GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(serverClientId)
                .setAutoSelectEnabled(false)
                .build();

            GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(googleIdOption)
                .build();

            credentialManager.getCredentialAsync(
                activity,
                request,
                new CancellationSignal(),
                bgExecutor,
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(@NonNull GetCredentialResponse result) {
                        if (resolveGoogleCredentialResult(activity, call, result)) {
                            return;
                        }
                        activity.runOnUiThread(() -> launchLegacyGoogleSignIn(activity, call, serverClientId, false));
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException e) {
                        if (e instanceof GetCredentialCancellationException) {
                            activity.runOnUiThread(() -> call.reject("User cancelled Google Sign-In", "USER_CANCELED"));
                            return;
                        }
                        boolean hadNoCredential = (e instanceof NoCredentialException);
                        // Fallback seamlessly to classic native Android GoogleSignInClient account picker
                        activity.runOnUiThread(() -> launchLegacyGoogleSignIn(activity, call, serverClientId, hadNoCredential));
                    }
                }
            );
        } catch (Exception ex) {
            launchLegacyGoogleSignIn(activity, call, serverClientId, false);
        }
    }

    private boolean resolveGoogleCredentialResult(Activity activity, PluginCall call, GetCredentialResponse result) {
        Credential credential = result.getCredential();
        if (
            credential instanceof CustomCredential &&
            GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())
        ) {
            try {
                GoogleIdTokenCredential googleCred = GoogleIdTokenCredential.createFrom(credential.getData());
                JSObject ret = new JSObject();
                ret.put("idToken", googleCred.getIdToken());
                ret.put("email", googleCred.getId());
                ret.put("displayName", googleCred.getDisplayName());
                if (googleCred.getProfilePictureUri() != null) {
                    ret.put("photoUrl", googleCred.getProfilePictureUri().toString());
                }
                ret.put("provider", "google-native-credential-manager");
                activity.runOnUiThread(() -> call.resolve(ret));
                return true;
            } catch (GoogleIdTokenParsingException ignored) {
                return false;
            }
        }
        return false;
    }

    private boolean legacyTriedAfterNoCredential = false;

    private void launchLegacyGoogleSignIn(Activity activity, PluginCall call, String serverClientId, boolean noCredentialFromCm) {
        this.legacyTriedAfterNoCredential = noCredentialFromCm;
        try {
            GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(serverClientId)
                .requestEmail()
                .requestProfile()
                .build();

            GoogleSignInClient signInClient = GoogleSignIn.getClient(activity, gso);
            Intent signInIntent = signInClient.getSignInIntent();
            startActivityForResult(call, signInIntent, "handleLegacyGoogleSignInResult");
        } catch (Exception ex) {
            call.reject(
                ex.getMessage() != null ? ex.getMessage() : "Native Google Sign-In failed",
                noCredentialFromCm ? "NO_GOOGLE_ACCOUNT" : "NATIVE_SIGN_IN_FAILED"
            );
        }
    }

    @ActivityCallback
    protected void handleLegacyGoogleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        Intent data = result != null ? result.getData() : null;
        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            if (account == null || account.getIdToken() == null || account.getIdToken().isEmpty()) {
                call.reject("Missing Google ID Token (check Web Client ID & SHA-1)", "MISSING_ID_TOKEN");
                return;
            }
            JSObject ret = new JSObject();
            ret.put("idToken", account.getIdToken());
            ret.put("email", account.getEmail());
            ret.put("displayName", account.getDisplayName());
            if (account.getPhotoUrl() != null) {
                ret.put("photoUrl", account.getPhotoUrl().toString());
            }
            ret.put("provider", "google-native-gms");
            call.resolve(ret);
        } catch (ApiException apiEx) {
            int statusCode = apiEx.getStatusCode();
            if (
                statusCode == GoogleSignInStatusCodes.SIGN_IN_CANCELLED ||
                statusCode == CommonStatusCodes.CANCELED
            ) {
                call.reject("User cancelled Google Sign-In", "USER_CANCELED");
                return;
            }
            if (statusCode == CommonStatusCodes.DEVELOPER_ERROR) {
                call.reject(
                    "ApiException: 10 (DEVELOPER_ERROR) - يجب إضافة بصمة SHA-1 لتطبيق com.almamo.hardware في Firebase Console.",
                    "DEVELOPER_ERROR"
                );
                return;
            }
            if (statusCode == CommonStatusCodes.SIGN_IN_REQUIRED || (legacyTriedAfterNoCredential && statusCode == GoogleSignInStatusCodes.INTERNAL_ERROR)) {
                call.reject("No signed-in Google account found on Android device", "NO_GOOGLE_ACCOUNT");
                return;
            }
            if (statusCode == CommonStatusCodes.NETWORK_ERROR) {
                call.reject("Network error during Google Sign-In", "NETWORK_ERROR");
                return;
            }
            call.reject(
                "GoogleSignIn ApiException: " + statusCode + " " + (apiEx.getMessage() != null ? apiEx.getMessage() : ""),
                "GMS_" + statusCode
            );
        } catch (Exception ex) {
            call.reject(ex.getMessage() != null ? ex.getMessage() : "Google Sign-In error", "NATIVE_SIGN_IN_ERROR");
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }

        try {
            CredentialManager credentialManager = CredentialManager.create(activity);
            credentialManager.clearCredentialStateAsync(
                new ClearCredentialStateRequest(),
                new CancellationSignal(),
                bgExecutor,
                new CredentialManagerCallback<Void, ClearCredentialException>() {
                    @Override
                    public void onResult(Void unused) {}

                    @Override
                    public void onError(@NonNull ClearCredentialException e) {}
                }
            );
        } catch (Exception ignored) {
        }

        try {
            String serverClientId = resolveServerClientId(call);
            GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(serverClientId)
                .requestEmail()
                .build();
            GoogleSignIn.getClient(activity, gso).signOut();
        } catch (Exception ignored) {
        }

        call.resolve();
    }
}
