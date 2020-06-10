## Terms

* Contributor: Someone who wishes to add to this code base but does not have merge and publish rights on this repository
* Maintainer: Someone who adds to this code base regularly and has merge and publish rights to this repository

As a `Contributor`:

* Fork this repo
* Submit a PR to the upstream
  

As a `Maintainer`:

* Follow the same pattern as `Contributor` for submitting code changes, new features, etc
* Publishing new versions of this npm package:
  1. Bump the `version` field of the package.json and update the changelog and commit directly to `master`
  2. Cut a release via Github's `releases` tab on this repository to trigger a GitHub `publish` action which will publish the latest version of this package to npmjs.org's public npm registry.
