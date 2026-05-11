# Recruitr MVP Build Blueprint
Prepared for the Recruitr product and engineering team
Updated: April 2, 2026

## Executive Summary
Recruitr already has a strong MVP foundation: role-based auth, public landing and waitlist capture, a ranked feed, athlete and coach profiles, messaging foundations, search, schools and teams, shortlists, notifications, public metrics, and seeded media support. The next stage is not "start building the product." The next stage is to harden the recruiting loop, convert demo-quality flows into production-ready flows, and prepare the system for a mobile-first launch.

The core product loop is:
- Athlete signs up
- Athlete completes a real profile
- Athlete uploads highlights and recruiting context
- Coach discovers the athlete in feed and search
- Coach opens profile and evaluates fit
- Coach saves the athlete or reel to a shortlist
- Verified coach messages the athlete
- Athlete receives and responds from mobile

The roadmap below is designed to complete that loop in a production-ready way while preserving speed of execution.

<!-- pagebreak -->

## Current Product State
### Working Today
- Role-based login and signup for athletes and coaches
- Landing page, legal pages, and waitlist capture
- Ranked feed with relevance and diversity logic
- Athlete and coach public profile surfaces
- Messaging and inbox foundations
- Search across users, schools, and teams
- Schools directory and school pages
- Coach shortlists and saved reels foundations
- Notifications foundation
- Public metrics page and pageview tracking
- Synthetic/demo data and local media support for testing

### What Is Still Demo-Grade
- Real media upload and storage lifecycle
- Full server-backed profile editing for both roles
- Comment persistence, replies, likes, and mentions
- Deeper shortlist organization and notes workflow
- Verification and moderation operations
- Production analytics quality and filtering
- Native mobile application

### Product Principles
- Mobile-first athlete experience
- Coach-first discovery and workflow tooling
- Public content, private outreach
- Verified coach trust model
- Video-first recruiting identity
- Feed and search should optimize for recruiting relevance, not generic virality

## MVP Definition
Recruitr MVP is complete when:
- An athlete can sign up on mobile and build a real profile
- An athlete can upload real photo and video highlights
- A coach can discover athletes through feed and search
- A coach can open a public athlete profile and evaluate fit
- A coach can save the athlete and reels to shortlists
- A verified coach can message the athlete
- The athlete can receive and reply on mobile
- Notifications and moderation basics are live
- Uploads, profiles, and messaging are persistent and reliable in production

<!-- pagebreak -->

## Product Workstreams
### 1. Core Recruiting Loop
Objective: make the athlete-to-coach loop complete and reliable.

Must build:
- Real athlete and coach account creation polish
- Full profile completion flow for both roles
- Stable cross-linking from feed, search, shortlist, and profile pages
- Reliable save-to-shortlist and save-reel flows
- Verified coach message initiation enforcement across all entry points

Definition of done:
- A user can move end-to-end through the recruiting loop without touching mock or local-only behaviors

### 2. Real Media Upload Pipeline
Objective: replace demo media behavior with production-style uploads.

Must build:
- Upload session flow for posts, avatars, banners, and message attachments
- MinIO-backed storage now, with migration path to Cloudflare Stream or Mux later
- Upload states: pending, processing, ready, failed
- Poster/thumbnail support for videos
- File-size and MIME validation
- Retry and error recovery UX

Definition of done:
- A user can upload real media from phone or web and see it reliably in profile, feed, and DM

### 3. Profiles and Identity
Objective: make athlete and coach profiles credible recruiting identities.

Athlete profile requirements:
- Profile photo, banner, school identity, bio, stats, academic info
- Post grid/reels tab
- Edit mode persisted to server
- Public view for coaches and other users

Coach profile requirements:
- Profile photo, banner, bio, school/team/title, sport, level, coaching history
- Verification status surfaced clearly
- Public-facing recruiting credibility

Definition of done:
- Profiles communicate identity, fit, and trust without relying on seeded placeholders

<!-- pagebreak -->

## Social, Discovery, and Workflow Systems
### 4. Feed, Comments, and Social Graph
Objective: turn the feed into a real recruiting conversation surface.

Must build:
- Server-backed comments
- Replies to comments
- Comment likes
- @mentions and mention notifications
- Follow and unfollow consistency across the app
- Better negative-signal handling: hide, report, suppress

Algorithm direction:
- Preserve the current ranking base: recency, diversity, fit signals, engagement quality, and follow-awareness
- Extend with coach recruiting preferences, position/sport relevance, and negative feedback suppression
- Treat coach posts and athlete posts differently in ranking and save behavior

Definition of done:
- The feed generates trustworthy discovery and meaningful recruiting interaction, not just passive viewing

### 5. Search and Explore
Objective: make athlete discovery fast and high intent.

Must build:
- Reliable Meilisearch indexing for users, schools, teams, and eventually posts
- Better autocomplete quality with avatars and logos
- Persistent filters
- Explore categories driven by real data instead of mocks
- Preference-based suggestions for coaches

Definition of done:
- A coach can intentionally find the right athletes, not just browse the feed

### 6. Coach Workflow Tools
Objective: make Recruitr operationally valuable to coaches.

Must build:
- Multiple shortlist lists
- Reel deep links from shortlist
- Athlete notes and recruiting tags
- Saved searches that actually execute
- Better organization of prospects by school, class, position, and priority

Definition of done:
- A coach can manage recruiting workflow in Recruitr instead of spreadsheets and ad hoc notes

<!-- pagebreak -->

## Trust, Notifications, and Operations
### 7. Verification and Moderation
Objective: protect athletes and keep outreach credible.

Must build:
- Coach verification submission flow
- Review queue or admin moderation tools
- Verified-only message initiation gates
- Report user and report post flows
- Block and hide flows
- Suspension handling

Definition of done:
- Safety controls exist at the points of highest risk: posting, discovery, and messaging

### 8. Notifications and Re-engagement
Objective: make core actions visible and bring users back.

Must build:
- Notifications for messages, follows, comments, mentions, shortlist-related interest, and key recruiting events
- Mark read, mark all read, and notification preferences
- Strong mobile notification model to support later push delivery

Definition of done:
- Users are reliably informed when something relevant happens

### 9. Analytics and Admin Visibility
Objective: let the team operate the product with confidence.

Must build:
- Public and internal metrics that distinguish real users from seeded/demo traffic
- Stronger event taxonomy for view, profile open, shortlist save, message created, comment created
- Basic admin visibility into growth, engagement, and operational issues

Definition of done:
- Product and engineering can answer "what is happening?" without guesswork

<!-- pagebreak -->

## Mobile Application Blueprint
Recruitr must be treated as a mobile-facing product, even while web continues to lead MVP development.

### Mobile Product Priorities
- Feed should feel native and thumb-friendly
- Athlete profiles should feel like first-class mobile identity pages
- Messaging and notifications should be fast and reliable
- Uploads must support phone camera workflows, slow networks, and foreground/background transitions

### Recommended Stack
- Expo + React Native
- Reuse the existing FastAPI backend and contracts
- Keep ranking, profiles, search, shortlists, and messaging logic in the backend, not duplicated in clients

### Mobile Readiness Before Native Build
Before heavy native implementation begins, lock down:
- Auth contract
- Feed contract
- Profile contract
- Upload contract
- Messaging contract
- Notification contract

### Phase Plan for Mobile
Phase A: mobile-ready web parity
- Finish mobile-first layouts and flows on web
- Remove local-only state from critical actions

Phase B: native shell
- Login and signup
- Feed
- Athlete profile
- Coach profile
- Search and explore
- Inbox
- Notifications

Phase C: native creation and retention
- Create post
- Edit profile
- Upload media
- Push notifications

Definition of done:
- Athletes can comfortably use Recruitr as a mobile product, not a shrunken desktop site

<!-- pagebreak -->

## Platform and Infrastructure Blueprint
### Backend and Data
- Bring all current tables and assumptions under Alembic control
- Remove remaining mystery-schema dependencies
- Add background jobs for indexing and media processing
- Improve analytics event quality

### Search and Storage
- Meilisearch for discovery and autocomplete
- MinIO/S3-compatible object storage now
- Planned migration path to Cloudflare Stream or Mux for video delivery and processing

### Production Hardening
- Rate limiting
- Error monitoring
- Request logging
- Backup strategy
- Secret management
- CORS and environment discipline

### Risks to Watch
- Demo data polluting analytics
- Local-only state creating false confidence in feature completeness
- Building native too early before contracts stabilize
- Media pipeline complexity arriving late in the schedule

## Delivery Sequence
### Immediate Next Milestones
1. Real media upload pipeline
2. Full server-backed athlete and coach profile editing
3. Server-backed comments, replies, and mentions
4. Better shortlist workflow and notes
5. Verification and moderation basics
6. Notification completion
7. Search and ranking iteration
8. Native mobile app shell

### Suggested Team Workstreams
- Backend: uploads, contracts, messaging rules, moderation, events, search indexing
- Web: profile editing, feed interactions, shortlist UX, notifications, metrics/admin
- Mobile: begin after contracts stabilize; prioritize feed, profile, messaging, and uploads
- Product/Design: mobile-first flows, athlete creation journey, coach evaluation workflow, trust surfaces

### Next 90-Day Goal
Make the recruiting loop production-real:
- real uploads
- real identity
- real discovery
- real saves and shortlists
- real outreach
- real trust controls

If that is complete, Recruitr will be in position to shift from a strong prototype into a launchable MVP.
