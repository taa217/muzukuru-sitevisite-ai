from typing import Annotated, Sequence, TypedDict
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """
    The state of the agent, tracking the conversation message history.
    Can be extended with custom fields as needed.
    """
    messages: Annotated[Sequence[BaseMessage], add_messages]
