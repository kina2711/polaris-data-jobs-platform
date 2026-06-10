// Dictionary of common IT skills for entity extraction
const IT_SKILLS_DICTIONARY = [
  'react', 'reactjs', 'react native', 'angular', 'vue', 'vuejs', 'nextjs', 'nuxt', 'svelte',
  'node', 'nodejs', 'express', 'nest', 'nestjs', 'django', 'flask', 'fastapi',
  'spring boot', 'laravel', 'ruby on rails', '.net', 'asp.net',
  'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'php', 'ruby', 'go', 'golang', 'rust', 'swift', 'kotlin',
  'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'github actions',
  'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'oracle', 'sql server',
  'graphql', 'rest api', 'grpc', 'rabbitmq', 'kafka',
  'machine learning', 'deep learning', 'nlp', 'computer vision', 'data science', 'data engineering',
  'pytorch', 'tensorflow', 'scikit-learn', 'pandas', 'numpy',
  'html', 'css', 'sass', 'less', 'tailwind', 'bootstrap',
  'figma', 'ui/ux',
  'agile', 'scrum', 'jira', 'confluence'
];

export function extractSkills(text: string): string[] {
  if (!text) return [];
  const normalizedText = text.toLowerCase();
  const extracted = new Set<string>();

  IT_SKILLS_DICTIONARY.forEach((skill) => {
    // Regex to match the skill as a whole word (simple boundary)
    // Note: \b doesn't work well with symbols like ++ or .net, so we do custom boundaries
    
    // For C++, C#, .NET etc
    let regexStr = skill;
    if (skill === 'c++') regexStr = 'c\\+\\+';
    else if (skill === 'c#') regexStr = 'c#';
    else if (skill === '.net') regexStr = '\\.net';
    else regexStr = `\\b${skill}\\b`;

    try {
      const regex = new RegExp(regexStr, 'g');
      if (regex.test(normalizedText)) {
        extracted.add(skill);
      }
    } catch (e) {
      // ignore regex error for weird skills
    }
  });

  return Array.from(extracted);
}

export function computeSkillGap(cvSkills: string[], jobSkills: string[]) {
  const matched = jobSkills.filter((s) => cvSkills.includes(s));
  const missing = jobSkills.filter((s) => !cvSkills.includes(s));
  
  return {
    matchedSkills: matched,
    missingSkills: missing,
    matchPercentage: jobSkills.length > 0 ? Math.round((matched.length / jobSkills.length) * 100) : null
  };
}
