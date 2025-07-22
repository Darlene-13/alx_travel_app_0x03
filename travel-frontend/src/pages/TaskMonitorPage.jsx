// src/pages/TaskMonitorPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { showToast } from '../components/Toast';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  CpuChipIcon,
  EnvelopeIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PlayIcon,
  EyeIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

const TaskMonitorPage = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    // Auto-refresh if enabled
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        refreshTaskStatus();
      }, 3000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, tasks]);

  const addTask = (taskData) => {
    setTasks(prev => {
      // Check if task already exists
      const exists = prev.some(t => t.task_id === taskData.task_id);
      if (exists) {
        // Update existing task
        return prev.map(t => 
          t.task_id === taskData.task_id 
            ? { ...t, ...taskData, lastUpdated: Date.now() }
            : t
        );
      } else {
        // Add new task
        return [{ ...taskData, lastUpdated: Date.now() }, ...prev.slice(0, 19)]; // Keep last 20
      }
    });
  };

  const refreshTaskStatus = async () => {
    // Update status for all pending tasks
    const pendingTasks = tasks.filter(t => 
      t.status === 'PENDING' || t.status === 'STARTED' || !t.ready
    );

    for (const task of pendingTasks) {
      try {
        const result = await apiService.tasks.checkEmailStatus(task.task_id);
        if (result.success) {
          addTask({
            ...task,
            ...result.data,
            lastUpdated: Date.now()
          });
        }
      } catch (error) {
        console.error('Error checking task status:', error);
      }
    }
  };

  const testCeleryConnection = async () => {
    setLoading(true);
    try {
      const result = await apiService.tasks.testCelery();
      
      if (result.success) {
        showToast('🚀 Celery test started!', 'success');
        
        // Add task to monitoring list
        addTask({
          task_id: result.data.task_id,
          type: 'celery_test',
          description: 'Celery Connection Test',
          status: 'PENDING',
          ready: false,
          created_at: new Date().toISOString()
        });

        // Check status after delay
        setTimeout(async () => {
          const statusResult = await apiService.tasks.checkEmailStatus(result.data.task_id);
          if (statusResult.success) {
            addTask({
              task_id: result.data.task_id,
              type: 'celery_test',
              description: 'Celery Connection Test',
              ...statusResult.data
            });
          }
        }, 2000);
      } else {
        showToast('❌ Celery test failed', 'error');
      }
    } catch (error) {
      showToast('❌ Error testing Celery', 'error');
    } finally {
      setLoading(false);
    }
  };

  const sendTestEmail = async () => {
    const email = testEmail || user?.linked_user?.email || 'test@example.com';
    
    try {
      const result = await apiService.tasks.sendTestEmail(email);
      
      if (result.success) {
        showToast(`📧 Test email queued for ${email}!`, 'success');
        
        // Add task to monitoring list
        addTask({
          task_id: result.data.task_id,
          type: 'email_test',
          description: `Test Email to ${email}`,
          status: 'PENDING',
          ready: false,
          created_at: new Date().toISOString()
        });

        setTestEmail('');
      } else {
        showToast('❌ Failed to send test email', 'error');
      }
    } catch (error) {
      showToast('❌ Error sending test email', 'error');
    }
  };

  const getStatusIcon = (task) => {
    if (task.status === 'SUCCESS' && task.ready) {
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    } else if (task.status === 'FAILURE' && task.ready) {
      return <XCircleIcon className="h-5 w-5 text-red-500" />;
    } else if (task.status === 'STARTED' || (task.status === 'PENDING' && !task.ready)) {
      return <div className="h-5 w-5"><LoadingSpinner size="sm" /></div>;
    } else {
      return <ClockIcon className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (task) => {
    if (task.status === 'SUCCESS' && task.ready) {
      return 'text-green-700 bg-green-50 border-green-200';
    } else if (task.status === 'FAILURE' && task.ready) {
      return 'text-red-700 bg-red-50 border-red-200';
    } else if (task.status === 'STARTED' || (task.status === 'PENDING' && !task.ready)) {
      return 'text-blue-700 bg-blue-50 border-blue-200';
    } else {
      return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    }
  };

  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return 'Unknown';
    }
  };

  const getTaskTypeIcon = (type) => {
    switch (type) {
      case 'email_test':
      case 'booking_email':
        return <EnvelopeIcon className="h-4 w-4" />;
      case 'celery_test':
        return <CpuChipIcon className="h-4 w-4" />;
      default:
        return <InformationCircleIcon className="h-4 w-4" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <CpuChipIcon className="h-8 w-8 mr-3 text-purple-600" />
          Background Task Monitor
        </h1>
        <p className="mt-2 text-gray-600">
          Monitor Celery background tasks in real-time, including email notifications.
        </p>
      </div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Test Controls */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <PlayIcon className="h-5 w-5 mr-2 text-green-600" />
            Test Controls
          </h3>
          
          <div className="space-y-4">
            {/* Celery Test */}
            <div className="flex items-center space-x-3">
              <button
                onClick={testCeleryConnection}
                disabled={loading}
                className="btn-primary flex-1"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Testing Celery...
                  </>
                ) : (
                  <>
                    <CpuChipIcon className="h-4 w-4 mr-2" />
                    Test Celery Connection
                  </>
                )}
              </button>
            </div>

            {/* Email Test */}
            <div className="flex items-center space-x-3">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder={user?.linked_user?.email || "Enter email address"}
                className="input flex-1"
              />
              <button
                onClick={sendTestEmail}
                className="btn-secondary"
              >
                <EnvelopeIcon className="h-4 w-4 mr-1" />
                Send Test Email
              </button>
            </div>

            {/* Auto Refresh */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Auto Refresh Tasks</span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoRefresh ? 'bg-primary-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoRefresh ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <EyeIcon className="h-5 w-5 mr-2 text-blue-600" />
            System Status
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm font-medium">Celery Worker</span>
              </div>
              <span className="text-sm text-green-600">Online</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm font-medium">Message Broker</span>
              </div>
              <span className="text-sm text-green-600">Connected</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <EnvelopeIcon className="h-5 w-5 text-blue-500 mr-2" />
                <span className="text-sm font-medium">Email Queue</span>
              </div>
              <span className="text-sm text-blue-600">Ready</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <InformationCircleIcon className="h-5 w-5 text-purple-500 mr-2" />
                <span className="text-sm font-medium">Active Tasks</span>
              </div>
              <span className="text-sm text-purple-600">
                {tasks.filter(t => !t.ready).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <ClockIcon className="h-5 w-5 mr-2 text-gray-600" />
            Recent Tasks ({tasks.length})
          </h3>
          <button
            onClick={refreshTaskStatus}
            className="btn-secondary text-sm"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Refresh Status
          </button>
        </div>

        {tasks.length > 0 ? (
          <div className="space-y-4">
            {tasks.map((task, index) => (
              <div
                key={`${task.task_id}-${index}`}
                className={`border rounded-lg p-4 ${getStatusColor(task)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getStatusIcon(task)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        {getTaskTypeIcon(task.type)}
                        <h4 className="text-sm font-medium text-gray-900">
                          {task.description || 'Background Task'}
                        </h4>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 font-mono">
                        Task ID: {task.task_id}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Created: {formatTime(task.created_at)}
                        {task.lastUpdated && (
                          <span className="ml-2">
                            • Updated: {formatTime(task.lastUpdated)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      task.status === 'SUCCESS' && task.ready
                        ? 'bg-green-100 text-green-800'
                        : task.status === 'FAILURE' && task.ready
                        ? 'bg-red-100 text-red-800'
                        : task.status === 'STARTED' || (task.status === 'PENDING' && !task.ready)
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {task.status || 'UNKNOWN'}
                    </span>
                  </div>
                </div>

                {/* Task Result */}
                {task.ready && task.result && (
                  <div className="mt-3 p-3 bg-white bg-opacity-50 rounded border border-opacity-20">
                    <p className="text-xs text-gray-700">
                      <strong>Result:</strong> {typeof task.result === 'string' ? task.result : JSON.stringify(task.result, null, 2)}
                    </p>
                  </div>
                )}

                {/* Task Error */}
                {task.ready && task.error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs text-red-700">
                      <strong>Error:</strong> {task.error}
                    </p>
                  </div>
                )}

                {/* Progress indicator for running tasks */}
                {!task.ready && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div className="bg-blue-500 h-1 rounded-full animate-pulse w-1/2"></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <CpuChipIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No tasks yet</h4>
            <p className="text-gray-600 mb-6">
              Start by testing Celery connection or sending a test email to see tasks appear here.
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={testCeleryConnection}
                disabled={loading}
                className="btn-primary"
              >
                <CpuChipIcon className="h-4 w-4 mr-1" />
                Test Celery
              </button>
              <button
                onClick={sendTestEmail}
                className="btn-secondary"
              >
                <EnvelopeIcon className="h-4 w-4 mr-1" />
                Send Test Email
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex">
          <InformationCircleIcon className="h-6 w-6 text-blue-600 flex-shrink-0" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800 mb-2">
              How Background Tasks Work
            </h3>
            <div className="text-sm text-blue-700 space-y-2">
              <p>• <strong>Booking Emails:</strong> When you create a booking, confirmation emails are sent asynchronously</p>
              <p>• <strong>Task Monitoring:</strong> All background tasks are tracked with real-time status updates</p>
              <p>• <strong>Reliability:</strong> Failed tasks are automatically retried up to 3 times</p>
              <p>• <strong>Performance:</strong> Users don't wait for email sending - it happens in the background</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskMonitorPage;