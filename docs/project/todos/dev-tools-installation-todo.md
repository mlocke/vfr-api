# Development Tools Installation - TODO Checklist

**Reference Document**: `/docs/project/plans/DEV-TOOLS-NEEDED-PLAN.md`  
**Created**: 2025-09-06  
**Status**: Ready for Execution  
**Estimated Time**: 80 minutes  

---

## 🚨 **Phase 1: Core Infrastructure Installation (30 min)**

### **Docker Desktop Installation**
- [ ] **CRITICAL-001**: Download Docker Desktop from https://www.docker.com/products/docker-desktop/
- [ ] **CRITICAL-002**: Install Docker Desktop application
- [ ] **CRITICAL-003**: Start Docker Desktop and wait for initialization
- [ ] **CRITICAL-004**: Verify installation: `docker --version`
- [ ] **CRITICAL-005**: Verify compose: `docker-compose --version`

**Success Criteria**: Both commands return version numbers without errors

### **Python 3.11+ Installation**
- [ ] **PYTHON-001**: Install Python 3.11+ via Homebrew: `brew install python@3.11`
- [ ] **PYTHON-002**: Verify installation: `python3.11 --version`
- [ ] **PYTHON-003**: Verify pip: `python3.11 -m pip --version`
- [ ] **PYTHON-004**: Add Python 3.11 to PATH if needed

**Success Criteria**: `python3.11 --version` shows 3.11+ 

### **Node.js Development Tools Installation**
- [ ] **NODE-001**: Install TypeScript globally: `npm install -g typescript`
- [ ] **NODE-002**: Install ESLint globally: `npm install -g eslint`
- [ ] **NODE-003**: Verify TypeScript: `tsc --version`
- [ ] **NODE-004**: Verify ESLint: `eslint --version`

**Success Criteria**: Both tools show version numbers

---

## 🐍 **Phase 2: Python Environment Setup (15 min)**

### **Virtual Environment Creation**
- [ ] **VENV-001**: Navigate to project root directory
- [ ] **VENV-002**: Create virtual environment: `python3.11 -m venv venv`
- [ ] **VENV-003**: Activate virtual environment: `source venv/bin/activate`
- [ ] **VENV-004**: Upgrade pip: `pip install --upgrade pip`
- [ ] **VENV-005**: Verify Python version in venv: `python --version`

**Success Criteria**: Python version shows 3.11+ within virtual environment

### **FastAPI Dependencies Installation**
- [ ] **FASTAPI-001**: Install core FastAPI: `pip install fastapi uvicorn[standard]`
- [ ] **FASTAPI-002**: Install database drivers: `pip install psycopg2-binary redis influxdb-client`
- [ ] **FASTAPI-003**: Install development tools: `pip install black flake8 mypy pytest`
- [ ] **FASTAPI-004**: Install data processing: `pip install pandas numpy`
- [ ] **FASTAPI-005**: Install environment management: `pip install python-dotenv`
- [ ] **FASTAPI-006**: Generate requirements file: `pip freeze > requirements.txt`

**Success Criteria**: All packages install without errors, requirements.txt created

---

## 🗄️ **Phase 3: Database Setup (20 min)**

### **Docker Compose Configuration**
- [ ] **DB-001**: Create `docker-compose.dev.yml` file in project root
- [ ] **DB-002**: Configure PostgreSQL 15 service with ports 5432
- [ ] **DB-003**: Configure Redis 7 service with ports 6379
- [ ] **DB-004**: Configure InfluxDB 2 service with ports 8086
- [ ] **DB-005**: Set up environment variables for database credentials
- [ ] **DB-006**: Create `.env.example` file with database configuration template

**Success Criteria**: Docker compose file ready for database services

### **Database Client Tools Installation**
- [ ] **CLIENT-001**: Install PostgreSQL client: `brew install postgresql`
- [ ] **CLIENT-002**: Install InfluxDB CLI: `brew install influxdb-cli`
- [ ] **CLIENT-003**: Verify PostgreSQL client: `psql --version`
- [ ] **CLIENT-004**: Verify Redis CLI availability (comes with Redis/Docker)

**Success Criteria**: Database client tools available for development

---

## ✅ **Phase 4: Installation Verification (15 min)**

### **Core Tools Verification**
- [ ] **VERIFY-001**: Test Docker: `docker --version`
- [ ] **VERIFY-002**: Test Docker Compose: `docker-compose --version`
- [ ] **VERIFY-003**: Test Python: `python3.11 --version`
- [ ] **VERIFY-004**: Test Node.js: `node --version`
- [ ] **VERIFY-005**: Test TypeScript: `tsc --version`
- [ ] **VERIFY-006**: Test ESLint: `eslint --version`

**Success Criteria**: All version commands return successfully

### **Python Environment Verification**
- [ ] **VERIFY-007**: Activate virtual environment: `source venv/bin/activate`
- [ ] **VERIFY-008**: Check pip packages: `pip list`
- [ ] **VERIFY-009**: Test FastAPI import: `python -c "import fastapi; print('FastAPI available')"`
- [ ] **VERIFY-010**: Test database drivers: `python -c "import psycopg2, redis, influxdb_client; print('DB drivers available')"`

**Success Criteria**: All Python imports succeed without errors

### **Database Connection Testing**
- [ ] **VERIFY-011**: Start databases: `docker-compose -f docker-compose.dev.yml up -d`
- [ ] **VERIFY-012**: Wait for services to initialize (30 seconds)
- [ ] **VERIFY-013**: Test PostgreSQL connection: `psql -h localhost -p 5432 -U postgres`
- [ ] **VERIFY-014**: Test Redis connection: `redis-cli ping`
- [ ] **VERIFY-015**: Test InfluxDB web interface: Open `http://localhost:8086` in browser

**Success Criteria**: All database connections successful

---

## 🚨 **Troubleshooting Checklist**

### **Common Issues & Solutions**
- [ ] **TROUBLE-001**: Docker permission issues → Add user to docker group
- [ ] **TROUBLE-002**: Port conflicts → Change ports in docker-compose.dev.yml
- [ ] **TROUBLE-003**: Python version conflicts → Use `python3.11` explicitly
- [ ] **TROUBLE-004**: Virtual environment issues → Recreate venv
- [ ] **TROUBLE-005**: npm permission errors → Configure npm prefix
- [ ] **TROUBLE-006**: Database connection failures → Check Docker service status

---

## 🎯 **Final Success Validation**

**Environment Setup Complete When:**
- [ ] **FINAL-001**: All core tools installed and verified
- [ ] **FINAL-002**: Python virtual environment active with all dependencies
- [ ] **FINAL-003**: All three databases (PostgreSQL, Redis, InfluxDB) running and accessible
- [ ] **FINAL-004**: Can create new Next.js project: `npx create-next-app@latest test-app --typescript --tailwind --eslint`
- [ ] **FINAL-005**: Can create basic FastAPI app and run: `uvicorn main:app --reload`

**SUCCESS**: ✅ Development environment ready for Phase 1 implementation  

---

## 📋 **Next Steps After Completion**

### **Immediate Actions:**
1. **Initialize Next.js Frontend Project**
2. **Create FastAPI Backend Project Structure** 
3. **Set up Development Databases with Initial Schemas**
4. **Configure Environment Variables for API Keys**

### **Reference Documents:**
- Implementation continues with `/docs/project/todos/TODO.md` Phase 1 tasks
- Architecture reference: `/docs/project/module-structure.md`
- Design system: `/docs/project/ui/design-system.md`

---

**Time Tracking:**
- **Start Time**: ___:___
- **Phase 1 Complete**: ___:___
- **Phase 2 Complete**: ___:___  
- **Phase 3 Complete**: ___:___
- **Final Verification**: ___:___
- **Total Time**: ___ minutes

**Status**: 
- [ ] Not Started
- [ ] In Progress  
- [ ] Completed Successfully
- [ ] Completed with Issues (document in project history)