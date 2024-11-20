import type { NextApiRequest, NextApiResponse } from 'next'

type ResponseData = {
  message: string
}
 
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  res.status(200).json({ message: `api/data
    Management Hello from Next.js!` })
}

/*
1. api/nostr/listeners/singleUser (this applies to all other listeners too)
  - create filter and connect to nostr relays
  - write each event to s3 using key: recentlyAddedEventsByEventId/<eventId>
2. api/dataManagement/s3/processNewEvents or /transferEventsToEventsTableFromS3 (first N events in S3) or /transferSpecifiedEventToEventsTableFromS3 (eventId provided in url)
  - generate list of events in endpoint: recentlyAddedEventsByEventId/* 
  for each event:
    - if event already present in table: events, do nothing
    - if not already present, write event to sql table: events with flaggedForProcessing=1
    - in s3, move event from recentlyAddedEventsByEventId/ into processedEventsByEventId/
3. api/dataManagement/events/processKind3Events
  - sql1: select kind3EventId_new from events where kind=3 and flaggedForProcessing=1
  - for each row:
    (_new refers to the event in events being processed; _old refers to the event previously processed which may or may not be replaced)
    - define pubkey, kind3EventId_new, created_at_new
    - sql2: select kind3EventId_old from users where pubkey=pubkey;
    - get event_old and event_new from s3 using keys: eventsByEventId/<kind3EventId_old> and eventsByEventId/<kind3EventId_new>
    - extract created_at_old and created_at_new from their respective events
    - if created_at_new > created_at_old, then:
      - sql3: update users set kind3eventId, flaggedForKind3EventProcessing=1 where pubkey;
    cleaning up:
    - sql4: update events set flaggedForProcessing=0 where eventId=kind3EventId_new



4. api/dataManagement/users/processKind3Events
- select * from users where flaggedForKind3EventProcessing=1
for each pubkey_parent:
  - fetch full event from s3 bucket using kind3eventId
  - in neo4j, remove all follows emanating from pubkey_parent
  - cycle through pubkeys in kind3Event. for each pubkey_child:
    - sql: add to users table if not already present 
    - neo4j: add node if not already present
    - add follow relationship in neo4j
  - sql: in table: users, set flaggedForKind3EventProcessing = 0

api/dataManagement/events/processKind10000Events
api/dataManagement/users/processKind10000Events

api/dataManagement/users/listen = api/nostr/listeners/multipleUsers 
*/