const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
};

export type Task = {
  id: string;
  title: string;
  notes: string;
  status: "todo" | "in_progress" | "done";
  priority: number;
  due_at?: string | null;
  created_at: string;
};

export type Goal = {
  id: string;
  title: string;
  why: string;
  metric: string;
  progress: number;
  status: "active" | "paused" | "complete";
  target_at?: string | null;
  created_at: string;
};

export type Memory = {
  id: string;
  category: string;
  content: string;
  importance: number;
  source: string;
  created_at: string;
};

export type CareerProfile = {
  id: string;
  current_role: string;
  target_role: string;
  strengths: string[];
  growth_areas: string[];
  roadmap: string[];
  updated_at: string;
};

export type Dashboard = {
  user: User;
  focus: {
    open_tasks: number;
    completed_tasks: number;
    active_goals: number;
    average_goal_progress: number;
  };
  recent_memories: Memory[];
  career: CareerProfile | null;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail ?? "Request failed");
  }
  return response.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (full_name: string, email: string, password: string) =>
    request<{ access_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ full_name, email, password }),
    }),
  me: (token: string) => request<User>("/auth/me", {}, token),
  dashboard: (token: string) => request<Dashboard>("/dashboard", {}, token),
  tasks: (token: string) => request<Task[]>("/tasks", {}, token),
  goals: (token: string) => request<Goal[]>("/goals", {}, token),
  memories: (token: string) => request<Memory[]>("/memories", {}, token),
  career: (token: string) => request<CareerProfile | null>("/career", {}, token),
  chat: (token: string, message: string, conversation_id?: string) =>
    request<{ conversation_id: string; answer: string; messages: Message[] }>(
      "/chat",
      { method: "POST", body: JSON.stringify({ message, conversation_id }) },
      token,
    ),
  createTask: (token: string, title: string) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify({ title }) }, token),
  createGoal: (token: string, title: string) =>
    request<Goal>("/goals", { method: "POST", body: JSON.stringify({ title }) }, token),
  createMemory: (token: string, content: string) =>
    request<Memory>("/memories", { method: "POST", body: JSON.stringify({ content }) }, token),
  saveCareer: (token: string, payload: Omit<CareerProfile, "id" | "updated_at">) =>
    request<CareerProfile>("/career", { method: "PUT", body: JSON.stringify(payload) }, token),
};

