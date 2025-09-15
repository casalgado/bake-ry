const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'src', 'models');
const targetDir = 'C:\\Users\\casal\\documents\\web\\front\\bake-ry-front\\src\\models';

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

function transformToES6(content) {
  // Transform require statements to import statements
  content = content.replace(
    /const\s+{\s*([^}]+)\s*}\s*=\s*require\(['"`]([^'"`]+)['"`]\);?/g,
    'import { $1 } from \'$2.js\';',
  );

  content = content.replace(
    /const\s+(\w+)\s*=\s*require\(['"`]([^'"`]+)['"`]\);?/g,
    'import $1 from \'$2.js\';',
  );

  // Transform module.exports to export default
  content = content.replace(/module\.exports\s*=\s*(\w+);?/, 'export default $1;');

  return content;
}

function copyAndTransformFile(source, target) {
  const targetDir = path.dirname(target);
  ensureDirectoryExists(targetDir);

  // Read the source file
  let content = fs.readFileSync(source, 'utf8');

  // Transform CommonJS to ES6
  content = transformToES6(content);

  // Write the transformed content to target
  fs.writeFileSync(target, content, 'utf8');
  console.log(`Synced and transformed: ${path.relative(sourceDir, source)} -> ${target}`);
}

function syncDirectory(source, target) {
  ensureDirectoryExists(target);

  const items = fs.readdirSync(source);

  for (const item of items) {
    const sourcePath = path.join(source, item);
    const targetPath = path.join(target, item);

    const stat = fs.statSync(sourcePath);

    if (stat.isDirectory()) {
      syncDirectory(sourcePath, targetPath);
    } else if (stat.isFile() && item.endsWith('.js')) {
      copyAndTransformFile(sourcePath, targetPath);
    }
  }
}

function main() {
  console.log('🔄 Syncing models from backend to frontend...');
  console.log(`Source: ${sourceDir}`);
  console.log(`Target: ${targetDir}`);
  console.log('');

  try {
    if (!fs.existsSync(sourceDir)) {
      console.error(`❌ Source directory not found: ${sourceDir}`);
      process.exit(1);
    }

    syncDirectory(sourceDir, targetDir);

    console.log('');
    console.log('✅ Models synced successfully!');

  } catch (error) {
    console.error('❌ Error syncing models:', error.message);
    process.exit(1);
  }
}

main();
