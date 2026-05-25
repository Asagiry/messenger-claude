import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getOnlineUsers } from '../ws/hub';

const router = Router();
router.use(authMiddleware);

router.get('/online', (_req, res) => {
  res.json({ users: getOnlineUsers() });
});

export default router;
