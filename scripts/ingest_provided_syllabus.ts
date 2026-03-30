
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const SYLLABUS_DATA = [
    {
        subject: 'Biology',
        topics: [
            { topic: 'Ecology', subtopics: ['Aquatic and Terrestrial Habitat', 'Basic Ecological Concepts', 'Ecological Management', 'Ecology of Population', 'Functioning Ecosystem'] },
            { topic: 'Evolution', subtopics: ['Variations / Adaptation for Survival / Evolution'] },
            { topic: 'Form and Functions', subtopics: ['Cell: Living Unit - Structure', 'Cell: Properties and Functions', 'Excretory Systems and Mechanisms', 'Feeding Mechanism / Digestive System', 'Gaseous Exchange / Respiratory System', 'Nervous Coordination', 'Nutrition / Photosynthesis / Food substances', 'Regulation of the Internal Environment', 'Sensory Receptors and Organs', 'Supporting systems and Mechanisms', 'Transport System and Mechanism'] },
            { topic: 'Heredity and Variations', subtopics: ['Development of New Organisms / Fruits', 'Genetics: The Science of Heredity', 'Sexual Reproduction: System / Behaviours'] },
            { topic: 'Variety of Organisms', subtopics: ['Classification or Organisation of Life', 'Micro-Organisms and Health'] }
        ]
    },
    {
        subject: 'Mathematics',
        topics: [
            { topic: 'Number and Numeration', subtopics: ['Financial Arithmetic', 'Fractions, Decimals, Percentages and Approximation', 'Indices', 'Logarithms', 'Matrices and Determinants', 'Modular Arithmetic', 'Number Bases', 'Positive and Negative Integers', 'Ratios, Proportions and Rates', 'Sets', 'Surds', 'Variations'] },
            { topic: 'Algebra', subtopics: ['Algebraic Fractions', 'Binary Operations', 'Change Of Subject Of Formula', 'Functions and Relations', 'Graph Of Linear and Quadratic Functions', 'Linear Inequalities', 'Polynomials', 'Progressions', 'Quadratic Equations', 'Simple Operations On Algebraic Expression', 'Solution Of Linear Equations'] },
            { topic: 'Calculus', subtopics: ['Application of differentiation', 'Application of Integration', 'Differentiation', 'Integration'] },
            { topic: 'Geometry and Trigonometry', subtopics: ['Angles and Intercepts on Parallel Lines', 'Angles of Elevation and Depression', 'Bearings and Distances', 'Circles', 'Construction', 'Coordinate Geometry of Straight Lines', 'Triangles and Polygons', 'Trigonometric Ratios'] },
            { topic: 'Mensuration', subtopics: ['Areas', 'Lengths and Perimeters', 'Volumes'] },
            { topic: 'Statistics', subtopics: ['Measures of Dispersion', 'Measures of Location', 'Permutation and Combination', 'Probability', 'Representation of data'] }
        ]
    },
    {
        subject: 'Physics',
        topics: [
            { topic: 'Electricity and Magnetism', subtopics: ['A.C. circuits', 'Capacitors', 'Current electricity', 'Electric cells', 'Electromagnetic induction', 'Electrostatics', 'Magnets and magnetic fields'] },
            { topic: 'Mechanics', subtopics: ['Equilibrium of Forces', 'Friction', 'Gravitational Field', 'Measurements and Units', 'Motion', 'Scalars and Vectors', 'Simple Machines', 'Work, Energy, and Power'] },
            { topic: 'Modern Physics', subtopics: ['Atomic structure', 'Nuclear energy', 'Photoelectric effect', 'Radioactivity', 'X-rays'] },
            { topic: 'Properties of Matter', subtopics: ['Elasticity', 'Liquids at Rest', 'Pressure'] },
            { topic: 'Thermal Physics', subtopics: ['Heat Transfer', 'Temperature and Heat', 'Vapours and Kinetic Theory'] },
            { topic: 'Waves and Optics', subtopics: ['Echo and reverberation', 'Electromagnetic spectrum', 'Mirrors and lenses', 'Reflection and refraction of light', 'Sound waves', 'Wave motion and properties'] }
        ]
    },
    {
        subject: 'Chemistry',
        topics: [
            { topic: 'Analytical and Environmental Chemistry', subtopics: ['Chemistry and industry', 'Environmental pollution', 'Oxidation and reduction', 'Separation of mixture and purification of chemical substances'] },
            { topic: 'Inorganic Chemistry', subtopics: ['Acids Bases and Salts', 'Air', 'Metals and their compound', 'Non-metals and their compounds', 'Water'] },
            { topic: 'Organic Chemistry', subtopics: ['Organic compound'] },
            { topic: 'Physical Chemistry', subtopics: ['Atomic structure and bonding', 'Chemical combination', 'Chemical equilibrium', 'Electrolysis', 'Energy changes', 'Kinetic theory of matter and gas law', 'Rates of a chemical reaction', 'Solubility'] }
        ]
    },
    {
        subject: 'Economics',
        topics: [
            { topic: 'Basic Concepts', subtopics: ['Economics as a science', 'Economic problems'] },
            { topic: 'Theory of Production', subtopics: ['Factors of Production and their Theories', 'Meaning and types of production', 'Division of labour and specialization', 'Factors affecting productivity', 'Producers equilibrium', 'Production functions and returns to scale', 'Scale of Production'] },
            { topic: 'Theory of Demand', subtopics: ['Meaning and determinants of demand', 'Types of demand', 'Types, nature and determinants of elasticity and their measurement', 'Importance of elasticity of demand to consumers, producers and government'] },
            { topic: 'Theory of Supply', subtopics: ['Meaning and determinants of supply', 'Types of Supply', 'Elasticity of Supply'] },
            { topic: 'Theory of Price Determination', subtopics: ['Equilibrium price and quantity in product and factor markets', 'Functions of the price system', 'Price legislation and its effects', 'The concepts of market and price', 'The effects of changes in supply and demand on equilibrium price and quantity'] },
            { topic: 'Financial Institutions', subtopics: ['Challenges facing financial institutions in Nigeria', 'Deposit money banks and the creation of money', 'Financial sector regulations', 'Monetary policy and its instruments', 'Money and capital markets', 'The role of financial institutions in economic development', 'Types and functions of financial institutions'] },
            { topic: 'Public Finance', subtopics: ['Fiscal policy and its instruments', 'Government budget and public debts', 'Meaning and objectives of Public Finance', 'Principles of taxation', 'Revenue allocation and resource control in Nigeria', 'Sources of government revenue', 'Tax incidence and its effects', 'The effects of public expenditure'] },
            { topic: 'International Trade', subtopics: ['Balance of trade and balance of payments', 'Composition and direction of Nigeria\'s foreign trade', 'Exchange rate', 'Meaning and basis for international trade'] }
        ]
    },
    {
        subject: 'Government',
        topics: [
            { topic: 'Basic Elements in Government', subtopics: ['Basic Principles of Government', 'Constitution', 'Forms of Government', 'Introduction to Government - Basic Concepts', 'Political Ideologies', 'Principles of a Democratic Government', 'Processes of Legislation', 'The Workings of Government I - Organs & Systems', 'The Workings of Government II - Unitary, Federal & Confederal Structures'] },
            { topic: 'Politics in Nigeria', subtopics: ['Colonial Administration I - British Colonial Administration', 'Colonial Administration II - French Colonial Administration', 'Constitutional Development in Nigeria I - Pre-Independence', 'Constitutional Development in Nigeria II - Independence & Post-Independence', 'Institutions of Government in Post-Independence Nigeria', 'Local Government Administration in Nigeria', 'Military Rule in Nigeria', 'Nigerian Federalism', 'Political Crises in Nigeria', 'Political Parties in Nigeria', 'Pre-Colonial Administration in Nigeria', 'The Process of Decolonization - Nationalism'] },
            { topic: 'International Relations', subtopics: ['Foreign Policy and Nigeria\'s Relationship with the International Community', 'International Organizations I - OAU, AU, ECOWAS, APPO', 'International Organizations II - League of Nations, UNO/UN, OPEC, The Commonwealth of Nations', 'Nigeria\'s Foreign Policy'] }
        ]
    }
];

async function ingestSyllabus() {
    console.log('🚀 Seeding granular JAMB syllabus...');
    
    // Clear existing to avoid constraint issues if unique is missing or misaligned
    console.log('🧹 Clearing existing syllabus...');
    await supabase.from('jamb_syllabus').delete().neq('subject', 'TRUNCATE');

    for (const item of SYLLABUS_DATA) {
        console.log(`\n📚 Subject: ${item.subject}`);
        const rows = item.topics.map(t => ({
            subject: item.subject,
            topic: t.topic,
            subtopics: t.subtopics,
            objectives: [],
            created_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('jamb_syllabus')
            .insert(rows);

        if (error) {
            console.error(`❌ Error seeding ${item.subject}:`, error.message);
        } else {
            console.log(`✅ Seeded ${rows.length} topics for ${item.subject}.`);
        }
    }
    
    console.log('\n🎉 Syllabus seeding complete!');
}

ingestSyllabus();
