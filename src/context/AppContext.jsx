import { createContext, useContext, useEffect, useReducer } from 'react';
import {
  getActivities,
  saveActivity as storageSave,
  deleteActivity as storageDelete,
  getSettings,
  saveSettings as storageSaveSettings,
} from '../utils/storage';
import {
  getCoachingPlan,
  saveCoachingPlan as storagesSavePlan,
  getGoal,
  saveGoal as storageSaveGoal,
} from '../utils/coachStorage';

const AppContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ACTIVITIES':
      return { ...state, activities: action.payload };
    case 'ADD_ACTIVITY': {
      const exists = state.activities.some((a) => a.id === action.payload.id);
      return {
        ...state,
        activities: exists ? state.activities : [action.payload, ...state.activities],
      };
    }
    case 'DELETE_ACTIVITY':
      return { ...state, activities: state.activities.filter((a) => a.id !== action.payload) };
    case 'UPDATE_ACTIVITY':
      return {
        ...state,
        activities: state.activities.map((a) =>
          a.id === action.payload.id ? { ...a, ...action.payload } : a
        ),
      };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    case 'SET_COACHING_PLAN':
      return { ...state, coachingPlan: action.payload };
    case 'SET_GOAL':
      return { ...state, goal: action.payload };
    case 'UPDATE_SESSION': {
      if (!state.coachingPlan) return state;
      const updated = {
        ...state.coachingPlan,
        sessions: state.coachingPlan.sessions.map((s) =>
          s.id === action.payload.id ? { ...s, ...action.payload.updates } : s
        ),
      };
      storagesSavePlan(updated);
      return { ...state, coachingPlan: updated };
    }
    case 'UPDATE_MILESTONE': {
      if (!state.coachingPlan) return state;
      const updated = {
        ...state.coachingPlan,
        milestones: state.coachingPlan.milestones.map((m) =>
          m.id === action.payload.id ? { ...m, ...action.payload.updates } : m
        ),
      };
      storagesSavePlan(updated);
      return { ...state, coachingPlan: updated };
    }
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, {
    activities: [],
    settings: getSettings(),
    coachingPlan: null,
    goal: null,
  });

  useEffect(() => {
    dispatch({ type: 'SET_ACTIVITIES', payload: getActivities() });
    dispatch({ type: 'SET_COACHING_PLAN', payload: getCoachingPlan() });
    dispatch({ type: 'SET_GOAL', payload: getGoal() });
  }, []);

  function addActivity(activity) {
    const { trackPoints, ...summary } = activity;
    storageSave(activity);
    dispatch({ type: 'ADD_ACTIVITY', payload: summary });
  }

  function deleteActivity(id) {
    storageDelete(id);
    dispatch({ type: 'DELETE_ACTIVITY', payload: id });
  }

  function updateActivity(activity) {
    const { trackPoints, ...summary } = activity;
    storageSave(activity);
    dispatch({ type: 'UPDATE_ACTIVITY', payload: summary });
  }

  function updateSettings(settings) {
    storageSaveSettings(settings);
    dispatch({ type: 'SET_SETTINGS', payload: settings });
  }

  function saveCoachingPlan(plan) {
    storagesSavePlan(plan);
    dispatch({ type: 'SET_COACHING_PLAN', payload: plan });
  }

  function saveGoal(goal) {
    storageSaveGoal(goal);
    dispatch({ type: 'SET_GOAL', payload: goal });
  }

  function updateSession(sessionId, updates) {
    dispatch({ type: 'UPDATE_SESSION', payload: { id: sessionId, updates } });
  }

  function updateMilestone(milestoneId, updates) {
    dispatch({ type: 'UPDATE_MILESTONE', payload: { id: milestoneId, updates } });
  }

  return (
    <AppContext.Provider
      value={{
        activities: state.activities,
        settings: state.settings,
        coachingPlan: state.coachingPlan,
        goal: state.goal,
        addActivity,
        deleteActivity,
        updateActivity,
        updateSettings,
        saveCoachingPlan,
        saveGoal,
        updateSession,
        updateMilestone,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
