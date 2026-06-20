module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        // browser
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        alert: "readonly",
        // jQuery
        jQuery: "readonly",
        $: "readonly",
        // worker
        self: "readonly",
        Worker: "readonly",
        MessageEvent: "readonly",
        postMessage: "readonly",
        // global & Node/Jest
        global: "readonly",
        module: "readonly",
        require: "readonly",
        console: "readonly",
        Promise: "readonly",
        Boolean: "readonly",
        Number: "readonly",
        Math: "readonly",
        isNaN: "readonly",
        Date: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "eqeqeq": "error",
      "curly": "error",
      "no-var": "error",
      "prefer-const": "error"
    }
  }
];
