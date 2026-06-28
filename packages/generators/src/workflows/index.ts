export function generateNpmWorkflow(outputDir: string): string {
  return `name: Publish to npm
on:
  pull_request:
    types: [closed]
    branches: [main]
jobs:
  publish:
    if: github.event.pull_request.merged == true && startsWith(github.head_ref, 'emitkit/')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: "https://registry.npmjs.org"
      - run: cd ${outputDir}/sdk/typescript && npm install && npm run build --if-present && npm publish
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
`;
}

export function generatePyPIWorkflow(outputDir: string): string {
  return `name: Publish to PyPI
on:
  pull_request:
    types: [closed]
    branches: [main]
jobs:
  publish:
    if: github.event.pull_request.merged == true && startsWith(github.head_ref, 'emitkit/')
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: cd ${outputDir}/sdk/python && pip install build && python -m build
      - uses: pypa/gh-action-pypi-publish@release/v1
        with:
          packages-dir: ${outputDir}/sdk/python/dist/
`;
}
