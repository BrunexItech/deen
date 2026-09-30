/**
 * Signs `assembleRelease` / `bundleRelease` with the DEEN upload key.
 * Credentials come from Gradle properties or environment (never from git):
 *   DEEN_UPLOAD_STORE_FILE, DEEN_UPLOAD_STORE_PASSWORD, DEEN_UPLOAD_KEY_ALIAS, DEEN_UPLOAD_KEY_PASSWORD
 * Without them the build falls back to the debug key (fine for local testing only).
 */
const { withAppBuildGradle } = require("expo/config-plugins");

const SIGNING = `
        release {
            def p = { String k -> project.findProperty(k) ?: System.getenv(k) }
            if (p("DEEN_UPLOAD_STORE_FILE")) {
                storeFile file(p("DEEN_UPLOAD_STORE_FILE"))
                storePassword p("DEEN_UPLOAD_STORE_PASSWORD")
                keyAlias p("DEEN_UPLOAD_KEY_ALIAS")
                keyPassword p("DEEN_UPLOAD_KEY_PASSWORD")
            } else {
                storeFile file("debug.keystore")
                storePassword "android"
                keyAlias "androiddebugkey"
                keyPassword "android"
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes("DEEN_UPLOAD_STORE_FILE")) {
      src = src.replace(/signingConfigs\s*\{/, (m) => `${m}${SIGNING}`);
      // Point the release build type at the release signing config.
      src = src.replace(/(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/s, "$1signingConfig signingConfigs.release");
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
