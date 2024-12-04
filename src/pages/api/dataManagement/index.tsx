import type { NextApiRequest, NextApiResponse } from 'next'

type ResponseData = {
  message: string
}
 
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  res.status(200).json({ message: `api/dataManagement Hello from Next.js!` })
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
- sql1: select * from users where flaggedForKind3EventProcessing=1
for each pubkey_parent:
  - get pubkey_parent, kind3EventId
  - sql2: UPDATE users SET flaggedToUpdateNeo4jFollows=1 WHERE pubkey=pubkey_parent
  - get kind3Event from s3 using kind3EventId
  - cycle through each pubkey_child in kind3Event:
    - const pubkey_child
    - sql3: INSERT IGNORE INTO users (pubkey, flaggedToUpdateNeo4jNode) VALUES (pubkey_child, 1)
      (if already present, do nothing, including no need to set flaggedToUpdateNeo4jNode=1)
  // cleaning up
  - sql4: UPDATE users SET flaggedForKind3EventProcessing = 0 WHERE pubkey=pubkey_parent
5. api/dataManagement/users/updateNeo4jNode
- sql1: select * from users where flaggedToUpdateNeo4jNode=1
for each row:
  - get const pubkey_parent
  - cypher1: add node for pubkey_parent if not already present
  // cleaning up
  - sql2: UPDATE users SET flaggedToUpdateNeo4jNode = 0 WHERE pubkey=pubkey_parent
6. api/dataManagement/users/updateNeo4jFollows
- select * from users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0 (wait until parent node is properly updated)
for each row:
  - get const pubkey_parent, const kind3EventId
  - cypher1: add node for pubkey_parent if does not already exist
  - cypher2: remove all FOLLOWS edges starting at pubkey_parent
  - s3_1: get kind3Event using kind3EventId
  - cycle through each pubkey_child in kind3Event:
    - const pubkey_child
    - cypher3: add node for pubkey_child if does not already exist
    (TODO: need to add pubkey_child to sql table users if not already present ???)
    - cypher4: add edge FOLLOWS from pubkey_parent to pubkey_child
  // cleaning up
  - sql2: UPDATE users SET flaggedToUpdateNeo4jFollows = 0 WHERE pubkey=pubkey_parent


1b. api/dataManagement/users/listen = api/nostr/listeners/multipleUsers 





3b. api/dataManagement/events/processKind10000Events
4b. api/dataManagement/users/processKind10000Events


*/