import { createContext, useContext, useEffect, useReducer } from 'react';
import {
  getActivities,
  saveActivity as storageSave,
  deleteActivity as storageDelete,
  getSettings,
  saveSettings as storageSaveSettings,
} from '../utils/storage';

const AppContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ACTIVITIES':
      return { ...state, activities: action.payload };
    case 'ADD_ACTIVITY': {
      const exists = state.activities.some((a) => a.id === action.payload.id);
      return {
        ...state,
        activities: exists
          ? state.activities
          : [action.payload, ...state.activities],
      };
    }
    case 'DELETE_ACTIVITY':
      return {
        ...state,
        activities: state.activities.filter((a) => a.id !== action.payload),
      };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, {
    activities: [],
    settings: getSettings(),
  });

  // Load activities on mount
  useEffect(() => {
    dispatch({ type: 'SET_ACTIVITIES', payload: getActivities() });
  }, []);

  function addActivity(activity) {
    // Strip trackPoints from what goes into context (they're in localStorage)
    const { trackPoints, ...summary } = activity;
    storageSave(activity);
    dispatch({ type: 'ADD_ACTIVITY', payload: summary });
  }

  function deleteActivity(id) {
    storageDelete(id);
    dispatch({ type: 'DELETE_ACTIVITY', payload: id });
  }

  function updateSettings(settings) {
    storageSaveSettings(settings);
    dispatch({ type: 'SET_SETTINGS', payload: settings });
  }

  return (
    <AppContext.Provider
      value={{
        activities: state.activities,
        settings: state.settings,
        addActivity,
        deleteActivity,
        updateSettings,
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
