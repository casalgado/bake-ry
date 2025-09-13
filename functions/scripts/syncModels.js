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

function copyFile(source, target) {
  const targetDir = path.dirname(target);
  ensureDirectoryExists(targetDir);

  fs.copyFileSync(source, target);
  console.log(`Synced: ${path.relative(sourceDir, source)} -> ${target}`);
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
      copyFile(sourcePath, targetPath);
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
