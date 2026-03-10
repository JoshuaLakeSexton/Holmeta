module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    webextensions: true
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "script"
  },
  globals: {
    chrome: "readonly"
  },
  ignorePatterns: [
    "dist/",
    "assets/",
    "docs/",
    "holmeta-extension.zip"
  ],
  rules: {
    "eqeqeq": [
      "error",
      "always",
      {
        null: "ignore"
      }
    ],
    "no-constant-condition": [
      "error",
      {
        checkLoops: false
      }
    ],
    "no-redeclare": "error",
    "no-unreachable": "error",
    "no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }
    ],
    "no-use-before-define": [
      "error",
      {
        functions: false,
        classes: true,
        variables: true
      }
    ]
  }
};
