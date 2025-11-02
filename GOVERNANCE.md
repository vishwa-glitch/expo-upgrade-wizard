# Project Governance

This document outlines the governance structure and decision-making process for Expo Upgrade Wizard.

## Project Vision

Expo Upgrade Wizard aims to make Expo SDK upgrades effortless, saving developers time and reducing upgrade friction through automation and intelligent guidance.

## Roles and Responsibilities

### Users

Anyone who uses Expo Upgrade Wizard. Users are encouraged to:
- Report bugs and issues
- Suggest features
- Participate in discussions
- Share their experiences

### Contributors

Anyone who contributes to the project through:
- Code contributions
- Documentation improvements
- Bug reports with detailed information
- Helping others in discussions
- Testing and providing feedback

### Maintainers

Trusted contributors with commit access who:
- Review and merge pull requests
- Triage issues
- Guide project direction
- Ensure code quality
- Manage releases
- Enforce Code of Conduct

Current maintainers:
- TBD (to be determined as project grows)

### Core Team

Maintainers who make strategic decisions about:
- Project roadmap
- Major architectural changes
- Governance changes
- Adding/removing maintainers

## Decision Making

### Consensus-Based

We strive for consensus on all decisions. When consensus cannot be reached:

1. **Discussion**: Open discussion in GitHub Discussions or issues
2. **Proposal**: Formal proposal with rationale
3. **Feedback Period**: Minimum 7 days for community input
4. **Vote**: Core team votes if consensus not reached
5. **Implementation**: Decision documented and implemented

### Types of Decisions

#### Minor Decisions (No Vote Required)
- Bug fixes
- Documentation updates
- Code refactoring
- Dependency updates
- Minor feature additions

#### Major Decisions (Require Discussion)
- Breaking changes
- New major features
- Architecture changes
- SDK version support
- API changes

#### Strategic Decisions (Require Core Team Vote)
- Project direction changes
- Governance changes
- Adding/removing maintainers
- Licensing changes
- Major partnerships

## Contribution Process

### 1. Propose

- Open an issue or discussion
- Describe the problem and proposed solution
- Get feedback from maintainers

### 2. Implement

- Fork the repository
- Create a feature branch
- Implement your changes
- Write tests (when applicable)
- Update documentation

### 3. Submit

- Open a pull request
- Link to related issues
- Describe your changes
- Respond to feedback

### 4. Review

- Maintainers review code
- Automated tests run
- Community provides feedback
- Changes requested if needed

### 5. Merge

- Approved by at least one maintainer
- All tests passing
- No unresolved discussions
- Merged by maintainer

## Becoming a Maintainer

Maintainers are selected based on:
- Consistent, high-quality contributions
- Deep understanding of the codebase
- Positive community interactions
- Commitment to project values
- Availability to review PRs and issues

Process:
1. Nominated by existing maintainer
2. Discussion among core team
3. Consensus or vote
4. Public announcement

## Removing Maintainers

Maintainers may be removed for:
- Inactivity (6+ months)
- Code of Conduct violations
- Consistent poor judgment
- Request to step down

Process:
1. Private discussion with maintainer
2. Core team consensus
3. Graceful transition of responsibilities
4. Public announcement (if appropriate)

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)

### Release Cycle

- Patch releases: As needed for critical bugs
- Minor releases: Monthly or when significant features ready
- Major releases: When breaking changes necessary

### Release Steps

1. Update CHANGELOG.md
2. Update version in package.json
3. Create release branch
4. Run full test suite
5. Create GitHub release
6. Publish to npm
7. Announce on social media

## Communication Channels

### Public Channels

- **GitHub Issues**: Bug reports, feature requests
- **GitHub Discussions**: Questions, ideas, general discussion
- **Discord**: Real-time chat (coming soon)
- **Twitter**: Announcements, updates

### Private Channels

- **Maintainer Email**: For sensitive issues
- **Security Email**: For security vulnerabilities

## Conflict Resolution

### Process

1. **Direct Communication**: Parties attempt to resolve directly
2. **Mediation**: Maintainer mediates if needed
3. **Core Team Review**: Escalate to core team if unresolved
4. **Final Decision**: Core team makes binding decision

### Code of Conduct Violations

Handled according to [Code of Conduct](CODE_OF_CONDUCT.md) enforcement guidelines.

## Amendments

This governance document can be amended by:
1. Proposal in GitHub Discussions
2. 14-day feedback period
3. Core team consensus or vote
4. Update document with changelog entry

## Transparency

We commit to:
- Public decision-making when possible
- Documented rationale for major decisions
- Open roadmap and planning
- Regular project updates
- Accessible communication channels

## Recognition

We recognize contributions through:
- CONTRIBUTORS.md listing
- Release notes mentions
- Social media shoutouts
- Maintainer status
- Speaking opportunities

## Resources

- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Support Guide](.github/SUPPORT.md)
- [Security Policy](SECURITY.md)

---

This governance model is inspired by successful open-source projects and will evolve as our community grows.

Last updated: October 30, 2025
