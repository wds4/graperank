import type { NextApiRequest, NextApiResponse } from 'next'

/*
to access:
http://localhost:3000/api/tests/neo4j/importCsv
https://graperank.tech/api/tests/neo4j/importCsv
*/

const cypher1 = `LOAD CSV FROM 'https://graperank.tech/api/tests/neo4j/generateCsv'
AS row
MERGE (n:NostrUser {pubkey: row[1]})-[:FOLLOWS]->(m:NostrUser {pubkey: row[2]})
`

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.status(200).send(cypher1)
}
