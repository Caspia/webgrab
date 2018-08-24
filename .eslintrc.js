module.exports = {
  env: {
    node: true
  },
  extends: "standard",
  rules: {
    semi: ["error", "always"],
    "space-before-function-paren": ["error", "never"],
  },
  parserOptions: {
    "ecmaVersion": 2018,
  }
}
