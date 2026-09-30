declare module 'vader-sentiment' {
	const vader: {
		SentimentIntensityAnalyzer: {
			polarity_scores(input: string): {
				neg: number;
				neu: number;
				pos: number;
				compound: number;
			};
		};
	};
	export = vader;
}
