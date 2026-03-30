-- Create past_questions table for JAMB past questions
CREATE TABLE public.past_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT,
  year INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  explanation TEXT,
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exam_sessions table for tracking CBT attempts
CREATE TABLE public.exam_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subjects TEXT[] NOT NULL,
  total_questions INTEGER NOT NULL DEFAULT 60,
  time_limit_minutes INTEGER NOT NULL DEFAULT 120,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  current_question_index INTEGER DEFAULT 0,
  answers JSONB DEFAULT '{}'::jsonb,
  time_spent_per_question JSONB DEFAULT '{}'::jsonb,
  question_order UUID[] DEFAULT ARRAY[]::UUID[],
  score INTEGER,
  diagnostic_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.past_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

-- RLS for past_questions (all authenticated users can read)
CREATE POLICY "Authenticated users can view past questions"
ON public.past_questions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage past questions"
ON public.past_questions FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS for exam_sessions (users can only access their own)
CREATE POLICY "Users can view their own exam sessions"
ON public.exam_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exam sessions"
ON public.exam_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exam sessions"
ON public.exam_sessions FOR UPDATE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_past_questions_subject ON public.past_questions(subject);
CREATE INDEX idx_past_questions_topic ON public.past_questions(subject, topic);
CREATE INDEX idx_exam_sessions_user ON public.exam_sessions(user_id);
CREATE INDEX idx_exam_sessions_status ON public.exam_sessions(user_id, status);

-- Trigger for updated_at
CREATE TRIGGER update_exam_sessions_updated_at
BEFORE UPDATE ON public.exam_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample past questions for testing
INSERT INTO public.past_questions (subject, topic, subtopic, year, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty)
VALUES
-- Physics
('Physics', 'Mechanics', 'Motion', 2023, 'A car accelerates uniformly from rest to a speed of 20 m/s in 10 seconds. What is the acceleration?', '1 m/s²', '2 m/s²', '10 m/s²', '20 m/s²', 'B', 'Using a = (v - u)/t = (20 - 0)/10 = 2 m/s²', 'easy'),
('Physics', 'Mechanics', 'Motion', 2022, 'An object is thrown vertically upward with an initial velocity of 40 m/s. What is the maximum height reached? (g = 10 m/s²)', '80 m', '40 m', '160 m', '20 m', 'A', 'Using v² = u² - 2gh, at max height v=0, so h = u²/2g = 1600/20 = 80 m', 'medium'),
('Physics', 'Waves', 'Sound', 2023, 'The speed of sound in air is 340 m/s. What is the wavelength of a sound wave of frequency 170 Hz?', '0.5 m', '1 m', '2 m', '4 m', 'C', 'Using λ = v/f = 340/170 = 2 m', 'easy'),
('Physics', 'Electricity', 'Current', 2022, 'What is the resistance of a conductor if a potential difference of 12V causes a current of 3A to flow through it?', '2 Ω', '4 Ω', '6 Ω', '36 Ω', 'B', 'Using R = V/I = 12/3 = 4 Ω', 'easy'),
('Physics', 'Optics', 'Reflection', 2021, 'A plane mirror produces an image that is:', 'Real and inverted', 'Virtual and inverted', 'Real and erect', 'Virtual and erect', 'D', 'Plane mirrors always produce virtual, erect images of the same size', 'easy'),
-- Chemistry
('Chemistry', 'Atomic Structure', 'Electron Configuration', 2023, 'The electronic configuration of sodium (atomic number 11) is:', '2, 8, 1', '2, 8, 2', '2, 1, 8', '2, 9', 'A', 'Sodium has 11 electrons distributed as 2 in K shell, 8 in L shell, 1 in M shell', 'easy'),
('Chemistry', 'Organic Chemistry', 'Alkanes', 2022, 'The IUPAC name of CH₃-CH₂-CH₂-CH₃ is:', 'Butane', 'Propane', 'Pentane', 'Ethane', 'A', 'This is a 4-carbon straight chain alkane, hence butane', 'easy'),
('Chemistry', 'Acids and Bases', 'pH', 2023, 'What is the pH of a solution with [H⁺] = 10⁻³ mol/dm³?', '1', '3', '11', '7', 'B', 'pH = -log[H⁺] = -log(10⁻³) = 3', 'medium'),
('Chemistry', 'Electrochemistry', 'Electrolysis', 2021, 'During electrolysis of dilute H₂SO₄, which gas is liberated at the cathode?', 'Oxygen', 'Hydrogen', 'Sulphur dioxide', 'Chlorine', 'B', 'At the cathode, H⁺ ions are reduced to form hydrogen gas', 'medium'),
('Chemistry', 'Chemical Bonding', 'Ionic Bonds', 2022, 'Which of these compounds has ionic bonding?', 'H₂O', 'CO₂', 'NaCl', 'CH₄', 'C', 'NaCl is formed by transfer of electrons from Na to Cl, creating ionic bonds', 'easy'),
-- Mathematics
('Mathematics', 'Algebra', 'Quadratic Equations', 2023, 'Solve: $x^2 - 5x + 6 = 0$', 'x = 2, 3', 'x = -2, -3', 'x = 1, 6', 'x = -1, -6', 'A', 'Factoring: (x-2)(x-3) = 0, so x = 2 or x = 3', 'easy'),
('Mathematics', 'Trigonometry', 'Ratios', 2022, 'If $\\sin\\theta = \\frac{3}{5}$, find $\\cos\\theta$', '$\\frac{4}{5}$', '$\\frac{5}{3}$', '$\\frac{3}{4}$', '$\\frac{5}{4}$', 'A', 'Using sin²θ + cos²θ = 1, cos²θ = 1 - 9/25 = 16/25, cosθ = 4/5', 'medium'),
('Mathematics', 'Calculus', 'Differentiation', 2023, 'Find $\\frac{dy}{dx}$ if $y = 3x^2 + 2x - 5$', '6x + 2', '6x - 2', '3x + 2', '6x', 'A', 'dy/dx = 6x + 2 - 0 = 6x + 2', 'easy'),
('Mathematics', 'Statistics', 'Mean', 2021, 'Find the mean of 2, 4, 6, 8, 10', '5', '6', '7', '8', 'B', 'Mean = (2+4+6+8+10)/5 = 30/5 = 6', 'easy'),
('Mathematics', 'Geometry', 'Circles', 2022, 'The area of a circle with radius 7 cm is: (π = 22/7)', '44 cm²', '154 cm²', '22 cm²', '308 cm²', 'B', 'Area = πr² = (22/7) × 49 = 154 cm²', 'easy'),
-- Biology
('Biology', 'Cell Biology', 'Cell Structure', 2023, 'Which organelle is responsible for protein synthesis?', 'Mitochondria', 'Ribosome', 'Golgi apparatus', 'Lysosome', 'B', 'Ribosomes are the sites where mRNA is translated into proteins', 'easy'),
('Biology', 'Genetics', 'Inheritance', 2022, 'The genotype of a carrier of sickle cell trait is:', 'HbAHbA', 'HbSHbS', 'HbAHbS', 'HbA', 'C', 'Carriers are heterozygous with one normal (HbA) and one sickle cell (HbS) allele', 'medium'),
('Biology', 'Ecology', 'Food Chain', 2023, 'In a food chain, producers are always:', 'Herbivores', 'Carnivores', 'Green plants', 'Decomposers', 'C', 'Producers are autotrophs (green plants) that make their own food through photosynthesis', 'easy'),
('Biology', 'Human Physiology', 'Respiration', 2021, 'Where does gaseous exchange occur in the lungs?', 'Bronchi', 'Trachea', 'Alveoli', 'Bronchioles', 'C', 'Alveoli are tiny air sacs where O₂ and CO₂ are exchanged between air and blood', 'easy'),
('Biology', 'Plant Biology', 'Photosynthesis', 2022, 'The green pigment in leaves that absorbs light energy is:', 'Xanthophyll', 'Carotene', 'Chlorophyll', 'Anthocyanin', 'C', 'Chlorophyll is the primary photosynthetic pigment that absorbs light', 'easy'),
-- English
('English', 'Comprehension', 'Vocabulary', 2023, 'Choose the word that best completes: The professor''s lecture was so _____ that many students fell asleep.', 'exciting', 'monotonous', 'brief', 'controversial', 'B', 'Monotonous means dull and repetitive, which would cause students to fall asleep', 'easy'),
('English', 'Grammar', 'Tenses', 2022, 'Choose the correct sentence:', 'He has went to school', 'He have gone to school', 'He has gone to school', 'He have went to school', 'C', 'Present perfect tense: has/have + past participle. "Gone" is correct, not "went"', 'easy'),
('English', 'Oral English', 'Stress', 2023, 'In the word "photograph", which syllable carries the primary stress?', 'First', 'Second', 'Third', 'Fourth', 'A', 'PHO-to-graph: stress is on the first syllable', 'medium'),
('English', 'Literature', 'Figures of Speech', 2021, '"The wind howled through the night" is an example of:', 'Simile', 'Metaphor', 'Personification', 'Hyperbole', 'C', 'Personification gives human qualities (howling) to non-human things (wind)', 'easy'),
('English', 'Grammar', 'Prepositions', 2022, 'She arrived _____ the airport _____ 6 pm.', 'at, in', 'in, at', 'at, at', 'in, in', 'C', 'We use "at" for specific locations (airport) and specific times (6 pm)', 'easy');