//-------------------------------| Lesson Content Models |-------------------------------//
export interface ILessonContent {
  explanation: string;
  summary: string[];
  examples: string[];
}

//-------------------------------| Quiz Models |-------------------------------//
export interface IQuiz {
  question: string;
  options: string[]; // Length 4 enforced on backend
  answer: string;
  answer_embedding?: number[]; // Optional in Pydantic
  explanation: string;
}

export interface IQuizSet {
  questions: IQuiz[];
}

//-------------------------------| Lesson TrueFalse Models |-------------------------------//
export interface ITrueFalseQuestion {
  question: string;
  options: string[]; // ['True', 'False']
  answer: 'True' | 'False'; // Literal types ensure strict matching
  answer_embedding?: number[];
}

export interface ITrueFalseSet {
  questions: ITrueFalseQuestion[];
}

//-------------------------------| Lesson Short Question Models |-------------------------------//
export interface IShortQuestion {
  question: string;
  answer: string;
  answer_embedding?: number[]; // Optional list of floats
}

export interface IShortQuestionSet {
  questions: IShortQuestion[];
}

//-------------------------------| Lesson Hierarchy Models |-------------------------------//
export interface ISectionScore {
  path: string;
  quiz_score: number;
  truefalse_score: number;
  shortquestion_score: number;
}

export interface ILessonHierarchy {
  path: string;
  title: string;
  parent_path: string | null;
  sections: ISectionScore[];
}