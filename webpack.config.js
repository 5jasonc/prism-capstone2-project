const path = require('path');

module: {
    rules: [
      ...
      {
        test: /three\/examples\/js/,
        use: 'imports-loader?THREE=three'
      }
    ]
  }