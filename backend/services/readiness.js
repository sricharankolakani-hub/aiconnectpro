'use strict';

function createReadinessHandler(supabase, logger = console) {
  return async function readinessHandler(_req, res) {
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error) {
        logger.error('Database readiness check failed', error);
        return res.status(503).json({ status: 'not_ready', dependency: 'database' });
      }
      return res.status(200).json({ status: 'ready', dependency: 'database' });
    } catch (error) {
      logger.error('Database readiness check failed', error);
      return res.status(503).json({ status: 'not_ready', dependency: 'database' });
    }
  };
}

module.exports = { createReadinessHandler };
