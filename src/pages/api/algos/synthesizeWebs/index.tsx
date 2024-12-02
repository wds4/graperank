import type { NextApiRequest, NextApiResponse } from 'next'

/*
read objects from S3:
customerData/${pubkey1}/dos
customerData/${pubkey1}/personalizedPageRank
... (will include grapeRank)
(could also include standard PageRank??)

And combine them into a single object which is stored at the endpoint:
customerData/${pubkey1}/combinedWebsOfTrust
*/

type ResponseData = {
  message: string
}
 
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  res.status(200).json({ message: 'api/algos/synthesizeWebs Hello from Next.js!' })
}
