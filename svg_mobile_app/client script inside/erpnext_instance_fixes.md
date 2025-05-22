# ERPNext Instance Troubleshooting and Fixes

## Issues Identified
1. Workers not working unless manually run
2. Scheduler status showing "process not found" in system health report
3. Socket.io not working
4. Bench restart failing with error: "frappe: ERROR (no such group)"

## Root Cause
The supervisor configuration for the test-bench instance wasn't properly linked to the system's supervisor configuration.

## Solution Steps

### 1. Update supervisor configuration for test-bench
```bash
cd ~/test-bench/
bench setup supervisor
```

### 2. Link the configuration to system supervisor
```bash
sudo ln -s `pwd`/config/supervisor.conf /etc/supervisor/conf.d/test-bench.conf
```

### 3. Reload supervisor to apply changes
```bash
sudo supervisorctl reload
```

### 4. Start all test-bench processes
```bash
sudo supervisorctl start test-bench:
```

## Additional Issues Found
Redis services for test-bench were failing to start with BACKOFF status:
```
test-bench-redis:test-bench-redis-cache                   BACKOFF   Exited too quickly
test-bench-redis:test-bench-redis-queue                   BACKOFF   Exited too quickly
```

## Potential Redis Fixes

### Check Redis logs
```bash
sudo supervisorctl tail test-bench-redis:test-bench-redis-cache stderr
sudo supervisorctl tail test-bench-redis:test-bench-redis-queue stderr
```

### Check for port conflicts between benches
```bash
cat ~/frappe-bench/config/redis_socketio.conf | grep port
cat ~/test-bench/config/redis_socketio.conf | grep port
```

### Modify Redis port configuration if needed
```bash
bench --site all set-redis-cache-port 13001
bench --site all set-redis-queue-port 13002
bench --site all set-redis-socketio-port 13003
```

### Update supervisor after port changes
```bash
bench setup supervisor
sudo ln -sf `pwd`/config/supervisor.conf /etc/supervisor/conf.d/test-bench.conf
sudo supervisorctl reload
```

### Verify all services
```bash
bench restart
sudo supervisorctl status
``` 