import { write } from '@/lib/neo4j'
import type { NextApiRequest, NextApiResponse } from 'next'

/*
to access:
https://graperank.tech/api/tests/neo4j/findDuplicates
*/

const cypher1 = `MATCH (n:NostrUser), (m:NostrUser) WHERE lower(n.pubkey)=lower(m.pubkey) AND n.pubkey <> m.pubkey RETURN n,m`

type ResponseData = {
  success: boolean,
  message: string,
  data?: object,
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const cypher1_result = await write(cypher1, {})
  console.log(`result: ${JSON.stringify(cypher1_result)}`)
  const aResults = JSON.parse(JSON.stringify(cypher1_result))

  const aPubkeyPairs = []
  for (let x=0; x < aResults.length; x++) {
    const oNextPair = aResults[x]
    const pk1 = oNextPair.n.properties.pubkey
    const pk2 = oNextPair.m.properties.pubkey
    aPubkeyPairs.push({pk1,pk2})
  }

  const response:ResponseData = {
    success: true,
    message: 'api/tests/neo4j/findDuplicates Hello from Next.js!!',
    data: {
      cypher1,
      aPubkeyPairs,
      cypher1_result,
    }
  }

  res.status(200).json(response)

}
