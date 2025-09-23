
// *ADVANCED SORTING ALGORITHMS*
// *1. RELEVANCE SCORING WITH ML-LIKE FEATURES*
export const calculateRelevanceScore = (job, searchQuery, userProfile = {}) => {
  let score = 0;
  
  if (!searchQuery) return Date.now() - new Date(job.dates?.posted || 0).getTime();
  
  const queryTerms = searchQuery.toLowerCase().split(' ').filter(Boolean);
  
  // Title match (highest weight)
  queryTerms.forEach(term => {
    if (job.title?.toLowerCase().includes(term)) score += 50;
  });
  
  // Skills match
  if (job.skills) {
    queryTerms.forEach(term => {
      job.skills.forEach(skill => {
        if (skill.name?.toLowerCase().includes(term)) score += 30;
      });
    });
  }
  
  // Company match
  if (job.company?.name?.toLowerCase().includes(queryTerms.join(' '))) score += 20;
  
  // Description match
  queryTerms.forEach(term => {
    if (job.description?.summary?.toLowerCase().includes(term)) score += 10;
  });
  
  // Boost for exact matches
  if (job.title?.toLowerCase() === searchQuery.toLowerCase()) score += 100;
  
  // Recency boost
  const daysOld = (Date.now() - new Date(job.dates?.posted || 0).getTime()) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 20 - daysOld); // Boost newer jobs
  
  return score;
};



// *3. TRENDING SCORE ALGORITHM* (Viral job detection)
export const calculateTrendingScore = (job) => {
  const now = new Date();
  const postedDate = new Date(job.dates?.posted || now);
  const hoursOld = (now - postedDate) / (1000 * 60 * 60);
  
  if (hoursOld > 168) return 0; // Only consider jobs from last week
  
  const applications = job.applicationsCount || 0;
  const views = job.viewsCount || 0;
  const shares = job.sharesCount || 0;
  
  // Engagement rate
  const engagementRate = applications / Math.max(views, 1);
  
  // Trending score = weighted engagement / time decay
  const timeDecay = Math.exp(-hoursOld / 48); // 48-hour half-life
  const trendingScore = (
    applications * 3 + 
    views * 1 + 
    shares * 5 + 
    engagementRate * 100
  ) * timeDecay;
  
  return trendingScore;
};

// *4. URGENCY SCORE* (Deadline-based sorting)
export const calculateUrgencyScore = (job) => {
  const now = new Date();
  const deadline = new Date(job.dates?.expires || job.dates?.applicationDeadline);
  
  if (!deadline) return 0;
  
  const hoursToDeadline = (deadline - now) / (1000 * 60 * 60);
  
  if (hoursToDeadline <= 0) return -1; // Expired
  if (hoursToDeadline <= 24) return 100; // Critical
  if (hoursToDeadline <= 72) return 80; // High
  if (hoursToDeadline <= 168) return 60; // Medium
  return 20; // Low
};

// *OPTIMIZED SORT QUERY BUILDER*
export const buildSortQuery = (filters) => {
  const query = {
    status: 'active',
    isDeleted: false,
  };
  
  if (!filters.includeExpired) {
    query['dates.expires'] = { $gt: new Date() };
  }
  
  if (filters.query) {
    query.$text = { $search: filters.query };
  }
  
  if (filters.location) {
    query['location.city'] = new RegExp(filters.location, 'i');
  }
  
  if (filters.minSalary || filters.maxSalary) {
    query['salary.min'] = {};
    if (filters.minSalary) query['salary.min'].$gte = filters.minSalary;
    if (filters.maxSalary) query['salary.max'] = { $lte: filters.maxSalary };
  }
  
  return query;
};

// *DYNAMIC SORT OPTIONS GENERATOR*
export const getSortOptions = (sortBy, sortOrder, userProfile, searchQuery) => {
  const order = sortOrder === 'asc' ? 1 : -1;
  
  const sortOptions = {
    // *BASIC SORTING*
    'relevance': searchQuery ? 
      { score: { $meta: 'textScore' }, 'dates.posted': -1 } :
      { 'dates.posted': -1 },
    'date': { 'dates.posted': order },
    'salary-high': { 'salary.max': -1, 'dates.posted': -1 },
    'salary-low': { 'salary.min': 1, 'dates.posted': -1 },
    'alphabetical': { 'title': order },
    
    // *ADVANCED SORTING*
    'company-rating': { 'company.rating': -1, 'company.reviewCount': -1, 'dates.posted': -1 },
    'applications': { 'applicationsCount': -1, 'dates.posted': -1 },
    'views': { 'viewsCount': -1, 'dates.posted': -1 },
    'company-size': { 'company.employeeCount': order, 'dates.posted': -1 },
    'deadline': { 'dates.expires': 1, 'dates.applicationDeadline': 1 },
    'featured': { 'featured': -1, 'premium': -1, 'dates.posted': -1 },
    
    // *COMPLEX SORTING* (handled separately)
    'trending': null, // Custom aggregation
    'match-score': null, // Custom calculation
    'distance': null, // Geo sorting
    'urgency': null, // Custom urgency calculation
    'experience-match': null, // Custom matching
  };
  
  return sortOptions[sortBy] || sortOptions['relevance'];
};

// *HELPER FUNCTIONS*

// Get performance hints for different sort types
export const getSortIndexHint = (sortBy) => {
  const indexHints = {
    'date': { 'dates.posted': -1, 'status': 1 },
    'salary-high': { 'salary.max': -1, 'status': 1 },
    'salary-low': { 'salary.min': 1, 'status': 1 },
    'company-rating': { 'company.rating': -1, 'status': 1 },
    'applications': { 'applicationsCount': -1, 'status': 1 },
    'views': { 'viewsCount': -1, 'status': 1 },
    'alphabetical': { 'title': 1, 'status': 1 },
    'featured': { 'featured': -1, 'premium': -1 }
  };
  return indexHints[sortBy] || null;
};

// Get human-readable sort description
export const getSortDescription = (sortBy) => {
  const descriptions = {
    'relevance': 'Search relevance and recency',
    'date': 'Most recent first',
    'salary-high': 'Highest salary first',
    'salary-low': 'Lowest salary first', 
    'company-rating': 'Best rated companies first',
    'applications': 'Most applied jobs first',
    'views': 'Most viewed jobs first',
    'trending': 'Trending based on engagement',
    'match-score': 'Best match for your profile',
    'distance': 'Closest to your location',
    'urgency': 'Urgent deadlines first',
    'featured': 'Featured jobs first',
    'alphabetical': 'Alphabetical by title'
  };
  return descriptions[sortBy] || 'Default sorting';
};
