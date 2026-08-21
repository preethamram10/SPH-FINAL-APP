const fs = require('fs');
const babel = require('@babel/core');

const code = fs.readFileSync('src/screens/Dashboard.js', 'utf8');

const plugin = function ({ types: t }) {
  return {
    visitor: {
      JSXExpressionContainer(path) {
        let parent = path.parent;
        if (parent && parent.type === 'JSXElement') {
          const parentName = parent.openingElement.name.name;
          if (parentName !== 'Text' && parentName !== 'RNText' && parentName !== 'Button') {
            const expr = path.node.expression;
            // if it's a string literal
            if (t.isStringLiteral(expr)) {
              console.log(`String literal { "${expr.value}" } inside <${parentName}> at line ${path.node.loc.start.line}`);
            }
            // if it's a template literal
            if (t.isTemplateLiteral(expr)) {
              console.log(`Template literal inside <${parentName}> at line ${path.node.loc.start.line}`);
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
