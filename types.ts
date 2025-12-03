export enum AppMode {
  CAPTION = 'CAPTION',
  EDIT = 'EDIT',
  ANALYZE = 'ANALYZE'
}

export interface MemeTemplate {
  id: string;
  url: string;
  name: string;
}

export interface CaptionSuggestion {
  text: string;
  category: 'Funny' | 'Sarcastic' | 'Relatable' | 'Dark' | 'Wholesome';
}

export interface AnalysisResult {
  description: string;
  tags: string[];
}
