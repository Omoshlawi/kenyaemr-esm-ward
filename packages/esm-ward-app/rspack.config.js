const config = require('openmrs/default-rspack-config');
config.scriptRuleConfig.exclude = /node_modules\/(?!@openmrs\/esm-patient-common-lib\/)/;
module.exports = config;
