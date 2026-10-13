const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");
module.exports = function withLocalPrivacy(config) {
  config = withAndroidManifest(config, config => {
    const app = config.modResults.manifest.application[0].$;
    app["android:allowBackup"] = "false";
    app["android:fullBackupContent"] = "@xml/slt_backup_rules";
    app["android:dataExtractionRules"] = "@xml/slt_data_extraction_rules";
    app["android:usesCleartextTraffic"] = "false";
    return config;
  });
  return withDangerousMod(config, ["android", async config => {
    const directory = path.join(config.modRequest.platformProjectRoot, "app/src/main/res/xml");
    await fs.mkdir(directory, { recursive: true });
    const excludes = ["root", "file", "database", "sharedpref", "external"].map(domain => `<exclude domain="${domain}" path="."/>`).join("\n");
    await fs.writeFile(path.join(directory, "slt_backup_rules.xml"), `<?xml version="1.0" encoding="utf-8"?><full-backup-content>${excludes}</full-backup-content>`);
    await fs.writeFile(path.join(directory, "slt_data_extraction_rules.xml"), `<?xml version="1.0" encoding="utf-8"?><data-extraction-rules><cloud-backup disableIfNoEncryptionCapabilities="true">${excludes}</cloud-backup><device-transfer>${excludes}</device-transfer></data-extraction-rules>`);
    return config;
  }]);
};
