const fs = require('fs');
const babel = require('@babel/core');

const code = fs.readFileSync('src/screens/Dashboard.js', 'utf8');

const plugin = function ({ types: t }) {
  return {
    visitor: {
      JSXText(path) {
        const text = path.node.value.replace(/\s+/g, '');
        if (text.length > 0) {
          let parent = path.parent;
          if (parent && parent.type === 'JSXElement') {
            const parentName = parent.openingElement.name.name;
            if (parentName !== 'Text' && parentName !== 'RNText' && parentName !== 't.Text') {
              console.log(`Found non-empty text node "${path.node.value.trim()}" inside <${parentName}> at line ${path.node.loc.start.line}`);
            }
          }
        }
      },
      JSXExpressionContainer(path) {
        // Find && expressions where left is not a boolean
        if (path.node.expression.type === 'LogicalExpression' && path.node.expression.operator === '&&') {
          // just log the line to review
          let parent = path.parent;
          if (parent && parent.type === 'JSXElement') {
            const parentName = parent.openingElement.name.name;
            if (parentName !== 'Text') {
              // We'll just review all LogicalExpressions inside non-Text
              // console.log(`LogicalExpression && inside <${parentName}> at line ${path.node.loc.start.line}`);
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
