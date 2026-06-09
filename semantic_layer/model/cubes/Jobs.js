cube(`Jobs`, {
  sql: `SELECT * FROM public.raw_jobs`,

  preAggregations: {
    // Pre-Aggregations definitions go here
  },

  joins: {},

  measures: {
    count: {
      type: `count`,
      drillMembers: [id, title, company, location, salary],
    },
  },

  dimensions: {
    id: {
      sql: `id`,
      type: `string`,
      primaryKey: true,
    },

    title: {
      sql: `title`,
      type: `string`,
    },

    company: {
      sql: `company`,
      type: `string`,
    },

    location: {
      sql: `location`,
      type: `string`,
    },

    salary: {
      sql: `salary`,
      type: `string`,
    },

    experience: {
      sql: `experience`,
      type: `string`,
    },

    source: {
      sql: `source`,
      type: `string`,
    },

    crawledAt: {
      sql: `crawled_at`,
      type: `time`,
    },
  },
});
