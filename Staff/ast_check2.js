const fs = require('fs');
const babel = require('@babel/core');

const code = fs.readFileSync('src/screens/Dashboard.js', 'utf8');

const plugin = function ({ types: t }) {
  return {
    visitor: {
      JSXExpressionContainer(path) {
        if (path.node.expression.type === 'LogicalExpression' && path.node.expression.operator === '&&') {
          let parent = path.parent;
          if (parent && parent.type === 'JSXElement') {
            const parentName = parent.openingElement.name.name;
            if (parentName !== 'Text' && parentName !== 'RNText') {
              // Log the source code of the left side of the &&
              const leftCode = code.substring(path.node.expression.left.start, path.node.expression.left.end);
              console.log(`&& inside <${parentName}> at line ${path.node.loc.start.line}. Left: ${leftCode}`);
            }
          }
        }
      }
    }
  };
};

babel.transformSync(code, {
  presets: ['@babel/preset-react'],
  plugins: [plugin],
  filename: 'src/screens/Dashboard.js'
});
