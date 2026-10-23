class OrderQueue {
    constructor() {
        this.heap = [];
    }

    // --- HELPER METHODS (Para sa tree traversal) ---
    getParentIndex(index) { return Math.floor((index - 1) / 2); }
    getLeftChildIndex(index) { return 2 * index + 1; }
    getRightChildIndex(index) { return 2 * index + 2; }

    hasParent(index) { return this.getParentIndex(index) >= 0; }
    hasLeftChild(index) { return this.getLeftChildIndex(index) < this.heap.length; }
    hasRightChild(index) { return this.getRightChildIndex(index) < this.heap.length; }

    parent(index) { return this.heap[this.getParentIndex(index)]; }
    leftChild(index) { return this.heap[this.getLeftChildIndex(index)]; }
    rightChild(index) { return this.heap[this.getRightChildIndex(index)]; }

    swap(indexOne, indexTwo) {
        const temp = this.heap[indexOne];
        this.heap[indexOne] = this.heap[indexTwo];
        this.heap[indexTwo] = temp;
    }

    // --- CORE DSA METHODS (Gikinahanglan sa Instructor) ---
    
    // 1. peek() - Tan-aw ang highest priority nga order nga wala pa na-remove
    peek() {
        if (this.isEmpty()) return null;
        return this.heap[0]; 
    }

    // 2. size() - Ibalik ang total number of orders sa queue
    size() {
        return this.heap.length;
    }

    // 3. isEmpty() - I-check kung walay sulod ang queue
    isEmpty() {
        return this.heap.length === 0;
    }

    // ➕ 4. BAG-O: getHeapSnapshot() (Puli sa wala nay printHeap para sa API ni Riza)
    getHeapSnapshot() {
        return this.heap.map(node => ({
            id: node.order.id,
            client: node.order.client || node.order.customer,
            priority: node.priority,
            priorityLabel: node.priority === 1 ? 'VIP' : 'Regular'
        }));
    }

    // 5. enqueue() - Idugang og bag-ong order
    enqueue(order, priority = 2) {
        // Algorithm 1: node <- {order, priority, timestamp <- current_time}
        const node = { order, priority, timestamp: Date.now() };
        this.heap.push(node);
        this.bubbleUp();
    }

    // 6. bubbleUp() - Algorithm 2
    bubbleUp() {
        let index = this.heap.length - 1;
        while (this.hasParent(index) && this.parent(index).priority > this.heap[index].priority) {
            this.swap(this.getParentIndex(index), index);
            index = this.getParentIndex(index);
        }
    }

    // 7. dequeue() - Algorithm 3
    dequeue() {
        if (this.isEmpty()) return null;
        if (this.size() === 1) return this.heap.pop().order;

        const item = this.heap[0];
        this.heap[0] = this.heap.pop();
        this.bubbleDown();
        return item.order;
    }

    // 8. bubbleDown() - Algorithm 4 (GI-FIX NI ANG NAPUTOL)
    bubbleDown() {
        let index = 0;
        while (this.hasLeftChild(index)) {
            let smallerChildIndex = this.getLeftChildIndex(index);
            if (this.hasRightChild(index) && this.rightChild(index).priority < this.heap[smallerChildIndex].priority) {
                smallerChildIndex = this.getRightChildIndex(index);
            }

            if (this.heap[index].priority <= this.heap[smallerChildIndex].priority) {
                break;
            } else {
                this.swap(index, smallerChildIndex);
            }
            index = smallerChildIndex;
        }
    }
}

// --- IMPORTANTE: I-EXPORT ANG CLASS PARA MAGAMIT NI RIZA SA PR #3 ---
module.exports = OrderQueue;

// =====================================================================
// --- TEST DRIVER (I-RUN NI PARA MAKAGAWA KAG SCREENSHOT EVIDENCE) ---
// Runs ONLY when executed directly: node .\server\orderQueue.js
// Does NOT run when imported via require() from other files (e.g., routes)
// =====================================================================
if (require.main === module) {
    const queue = new OrderQueue();

    console.log("--- 1. Testing Empty Queue (HT-02) ---");
    console.log("Is empty?", queue.isEmpty());       // dapat: true
    console.log("Peek empty:", queue.peek());        // dapat: null
    console.log("Dequeue empty:", queue.dequeue());  // dapat: null

    console.log("\n--- 2. Enqueue 4 Orders (HT-01, HT-06) ---");
    queue.enqueue({ id: 101, client: "Regular Client A" }, 2);
    queue.enqueue({ id: 102, client: "VIP Client B" }, 1);
    queue.enqueue({ id: 103, client: "Regular Client C" }, 2);
    queue.enqueue({ id: 104, client: "VIP Client D" }, 1);

    console.log("\n--- 3. Testing New Methods (HT-05) ---");
    console.log("Current size:", queue.size());      // dapat: 4
    console.log("Is empty?", queue.isEmpty());       // dapat: false
    console.log("Peek (Highest Priority):", queue.peek()); // dapat: VIP B
    console.log("Internal Heap Array (Snapshot):", queue.getHeapSnapshot()); // Gi-update ni para magamit ang bag-ong method

    console.log("\n--- 4. Dequeue All (VIP first, then Regular) ---");
    while (!queue.isEmpty()) {
        console.log("Dequeued:", queue.dequeue());
    }

    console.log("\n--- 5. Final State ---");
    console.log("Final size:", queue.size());        // dapat: 0
    console.log("Is empty now?", queue.isEmpty());   // dapat: true
}