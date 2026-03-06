const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// This script assumes GitHub CLI (`gh`) is installed and authenticated.
// It reads the version from package.json and looks for a matching
// RELEASE_NOTES_v<version>.md file, then creates or updates a GitHub
// release tagged v<version> with the file contents as the body.

function main() {
  const pkg = require('../package.json');
  const version = pkg.version;
  const tag = `v${version}`;
  const notesFile = path.resolve(__dirname, `../RELEASE_NOTES_v${version}.md`);

  if (!fs.existsSync(notesFile)) {
    console.error(`Release notes file not found: ${notesFile}`);
    process.exit(1);
  }

  try {
    console.log(`Creating/updating GitHub release ${tag} ...`);
    execSync(`gh release create ${tag} -F "${notesFile}" --prerelease=false --draft=false`, {
      stdio: 'inherit',
    });
    console.log(`Release ${tag} published.`);
  } catch (err) {
    console.error('Failed to create release:', err.message);
    process.exit(err.status || 1);
  }
}

main();
