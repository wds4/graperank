export type Pubkey = string

export type RatingsRequest2 = {
    observer: Pubkey,
    observee: Pubkey,
    kinds: number[],
}

export type RatingType = string // follow, mute

export type DoS = number | undefined

export type Rating = [Pubkey, DoS]

export type Ratings = Rating[]

export type Response = {
    ratings: Rating,
    observeeData: {
        dos: DoS
    }
}
/*
Example Response:
{
    observeeData: {
        dos: 5
    },
    ratings: {
        3: [
            [rator1, 4],
            [rator2, 5],
            [rator3, 4],
        ],
        10000: [
            [rator4, undefined ],
        ],
    }
}
*/