# Maintainer migration checklist

- [x] Rename package, CLI, bundle row, Skill and public links to `dsh-autofix`.
- [x] Move the deterministic fault engine to the `dsh-autofix/testkit` export.
- [x] Remove install-time source builds and include prebuilt `lib/` in the package.
- [x] Replace scenario configuration with the default automatic recovery runtime.
- [x] Add bilingual README, recipe catalog, compatibility matrix and recipe issue form.
- [x] Initialize an independent local `main` repository and stage only public project files.
- [ ] Commit after the repository-local author identity is configured by the maintainer.
- [ ] Create `cyanseek/dsh-autofix` and add it as the explicit remote.
- [ ] Run the release-candidate matrix on native Windows and macOS.
- [ ] Publish the npm package and create a GitHub Release only with separate authorization.

The previous repository and its remote do not need to be renamed in place. This project is prepared as a clean successor.
