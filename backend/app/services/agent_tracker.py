import asyncio
import datetime
import json
import logging
import uuid
from typing import Dict, List, Any, Optional, Set

logger = logging.getLogger(__name__)

class AgentActivityTracker:
    def __init__(self, max_history: int = 100):
        self.max_history = max_history
        self._history: List[Dict[str, Any]] = []
        self._subscribers: Set[asyncio.Queue] = set()
        
        # State tracking
        self._status: str = "idle"  # idle, active, thinking, error
        self._current_task: Optional[str] = None
        self._active_booking_id: Optional[int] = None
        self._active_venue_id: Optional[int] = None
        self._task_started_at: Optional[str] = None
        self._task_counter: int = 0

    def get_status(self) -> Dict[str, Any]:
        return {
            "status": self._status,
            "current_task": self._current_task,
            "active_booking_id": self._active_booking_id,
            "active_venue_id": self._active_venue_id,
            "task_started_at": self._task_started_at,
            "total_tasks_completed": self._task_counter,
            "total_events_logged": len(self._history)
        }

    def set_task_state(self, status: str, current_task: Optional[str] = None, booking_id: Optional[int] = None, venue_id: Optional[int] = None):
        self._status = status
        if current_task is not None:
            self._current_task = current_task
        if booking_id is not None:
            self._active_booking_id = booking_id
        if venue_id is not None:
            self._active_venue_id = venue_id
            
        if status == "active" and not self._task_started_at:
            self._task_started_at = datetime.datetime.now().isoformat()
        elif status == "idle":
            self._task_started_at = None
            self._current_task = None
            self._active_booking_id = None
            self._active_venue_id = None

    def log_activity(
        self,
        event_type: str,
        title: str,
        details: str = "",
        status: str = "info",
        extra: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Logs an agent activity event and broadcasts it to all connected SSE clients.
        event_type: 'task_start', 'task_complete', 'whatsapp', 'sql', 'search', 'image_search', 'web_scrape', 'thought', 'error'
        status: 'info', 'success', 'warning', 'error', 'running'
        """
        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        iso_str = datetime.datetime.now().isoformat()
        
        event = {
            "id": str(uuid.uuid4()),
            "timestamp": iso_str,
            "formatted_time": now_str,
            "event_type": event_type,
            "title": title,
            "details": details,
            "status": status,
            "agent_status": self._status,
            "current_task": self._current_task,
            "extra": extra or {}
        }
        
        if event_type == "task_complete":
            self._task_counter += 1
            self.set_task_state("idle")

        # Keep capped history
        self._history.append(event)
        if len(self._history) > self.max_history:
            self._history = self._history[-self.max_history:]
            
        # Broadcast to all live SSE subscribers
        self._broadcast(event)
        return event

    def _broadcast(self, event: Dict[str, Any]):
        dead_queues = set()
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning("Subscriber queue full, dropping event")
            except Exception as e:
                logger.warning(f"Failed to broadcast event to queue: {e}")
                dead_queues.add(queue)
                
        for dead in dead_queues:
            self.unsubscribe(dead)

    def get_history(self) -> List[Dict[str, Any]]:
        return list(self._history)

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.add(queue)
        logger.info(f"New SSE client subscribed to AgentActivityTracker. Total subscribers: {len(self._subscribers)}")
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        if queue in self._subscribers:
            self._subscribers.remove(queue)
            logger.info(f"SSE client unsubscribed. Remaining subscribers: {len(self._subscribers)}")

    def clear_history(self):
        self._history.clear()
        self.log_activity("system", "Activity history cleared", "Admin cleared activity log buffer", status="info")

# Global singleton instance
agent_tracker = AgentActivityTracker()
