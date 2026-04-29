
# **1. Core Definitions**

###  Concurrent Programming

- Multiple **threads of control**
    
- Tasks **make progress in the same time frame**
    
- Not necessarily simultaneous
    
- Can run on **single CPU (time-slicing)**
    

###  Parallel Programming

- Tasks execute **at the same time**
    
- Requires **multiple processors/cores**
    

###  Multitasking

- Running multiple tasks **concurrently over time**
    

---

#  **2. Key Terms (Must Use Correctly)**

- Concurrency
    
- Parallelism
    
- Multitasking
    

---

#  **3. Relationship**

- **Concurrency = general concept**
    
- **Parallelism = subset of concurrency**
    
- **Distributed systems = parallel systems over networks**
    

 Exam line:

> All parallel programs are concurrent, but not all concurrent programs are parallel.

---

#  **4. Why Use Concurrency**

- Improves **performance** (multi-core usage)
    
- Increases **throughput**
    
- Improves **responsiveness** (UI, real-time systems)
    
- Handles **multiple events/tasks simultaneously**
    

---

#  **5. Advantages**

- Faster execution (ideal case: t → t/n)
    
- Better resource utilization
    
- Supports distributed systems
    
- Models real-world parallel activities
    

---

#  **6. Limitations / Reality**

- Speedup is **not linear**
    
- Due to **parallel overhead**:
    
    - Task creation
        
    - Synchronization
        
    - Communication
        

---

#  **7. Concurrency vs Parallelism (Exam Comparison)**

|Feature|Concurrency|Parallelism|
|---|---|---|
|Execution|Overlapping|Simultaneous|
|Hardware|Single or multi-core|Multi-core required|
|Goal|Structure & responsiveness|Speed|

---

#  **8. Types of Concurrency**

### Implicit Concurrency

- Happens automatically (e.g., OS, hardware)
    

### Explicit Concurrency

- Defined by programmer (threads, code control)
    

---

#  **9. Key Challenges**

- Programs are **hard to design & debug**
    
- Requires:
    
    - **Communication** (data sharing)
        
    - **Synchronization** (ordering tasks)
        
    - **Atomicity** (no partial execution)
        

Common problems:

- Race conditions
    
- Deadlocks
    
- Non-deterministic bugs
    

---

# **10. Real-World Risks**

- Example failures:
    
    - Therac-25 (fatal errors)
        
    - Mars Rover (system resets)
        

 Key idea:  
**Concurrency errors can be critical and dangerous**

---

#  **11. Threads (Java Focus)**

### What is a Thread?

- A **unit of execution** within a program
    
- Has its own **stack & execution state**
    

### Creating Threads:

1. Extend `Thread`
    
2. Implement `Runnable`
    

### Key Methods:

- `start()` → begins execution
    
- `run()` → code executed
    
- `sleep()` → pause thread
    
- `yield()` → give up CPU
    
- `isAlive()` → check status
    

---

#  **12. Thread Lifecycle**

- Created → Alive → Running/Runnable → Terminated
    

---

#  **13. Concurrency Control**

- Mechanisms:
    
    - Locks
        
    - Semaphores
        
    - Monitors
        

 Purpose:

- Prevent conflicts in shared data
    

---

# **14. Important Exam Concepts**

- **Race condition:** outcome depends on execution order
    
- **Synchronization:** coordinating threads
    
- **Parallel overhead:** extra cost of managing threads
    
- **Non-determinism:** unpredictable execution order
    

# **Ultra-Short Memory Hook**


**Concurrency = structure (many tasks)**  
**Parallelism = speed (simultaneous tasks)**  
**Main issue = coordination (sync, race conditions, overhead)**


