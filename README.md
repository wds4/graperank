# GrapeRank

This repo provides an API which is accessed at `https://www.graperank.tech` by the front end: `grapevine-brainstorm.vercel.app`. It is housed on an AWS EC2 server and a ci/cd pipeline is established using github actions to push changes from github to the EC2 instance.

This backend scrapes nostr for kinds 3 and 10000 events, stores them in an S3 bucket, and runs scripts which import those events into SQL and from there into a neo4j graph database. 

API endpoints are also established which trigger the calculation of personalized webs of trust scores by users of the front end. These scores include GrapeRank, PageRank, and degrees of separation. Those scores are stored in large files in S3 which are then accessed by the front end and displayed in table format. As of Jan 2025, those scores can also be exported as kind 30382 events following the format of [NIP-85: Trusted Assertions](https://github.com/vitorpamplona/nips/blob/user-summaries/85.md) (see PR discussion [here](https://github.com/nostr-protocol/nips/pull/1534)).

