class BPlusNode {
    constructor(isLeaf = false) {
        this.keys = [];
        this.children = [];
        this.data = []; // Only for leaf nodes
        this.isLeaf = isLeaf;
        this.parent = null;
        this.next = null; // Only for leaf nodes
    }
}

class BPlusTree {
    constructor(order = 3) {
        this.order = order;
        this.root = new BPlusNode(true);
        this.firstLeaf = this.root;
    }

    insert(key, data = key) {
        // Find leaf node
        const leaf = this.findLeaf(key);
        
        // Insert into leaf
        const success = this.insertIntoLeaf(leaf, key, data);
        
        // Return if duplicate found
        if (!success) {
            return false;
        }
        
        // Check if leaf needs splitting
        if (leaf.keys.length > this.order - 1) {
            this.splitLeaf(leaf);
        }
        
        this.updateVisualization();
        return true;
    }

    findLeaf(key) {
        let current = this.root;
        
        while (!current.isLeaf) {
            let i = 0;
            while (i < current.keys.length && key >= current.keys[i]) {
                i++;
            }
            current = current.children[i];
        }
        
        return current;
    }

    insertIntoLeaf(leaf, key, data) {
        let i = 0;
        while (i < leaf.keys.length && key > leaf.keys[i]) {
            i++;
        }
        
        // Check for duplicates
        if (i < leaf.keys.length && leaf.keys[i] === key) {
            return false;
        }
        
        leaf.keys.splice(i, 0, key);
        leaf.data.splice(i, 0, data);
        return true;
    }

    splitLeaf(leaf) {
        const mid = Math.ceil((this.order - 1) / 2);
        
        // Create new leaf
        const newLeaf = new BPlusNode(true);
        newLeaf.keys = leaf.keys.splice(mid);
        newLeaf.data = leaf.data.splice(mid);
        
        // Link leaves
        newLeaf.next = leaf.next;
        leaf.next = newLeaf;
        
        // Key to promote
        const promoteKey = newLeaf.keys[0];
        
        // Insert into parent or create root
        if (leaf.parent === null) {
            const newRoot = new BPlusNode(false);
            newRoot.keys.push(promoteKey);
            newRoot.children.push(leaf, newLeaf);
            leaf.parent = newRoot;
            newLeaf.parent = newRoot;
            this.root = newRoot;
        } else {
            this.insertIntoParent(leaf, promoteKey, newLeaf);
        }
    }

    insertIntoParent(leftChild, key, rightChild) {
        const parent = leftChild.parent;
        rightChild.parent = parent;
        
        // Find insertion position
        let i = 0;
        while (i < parent.keys.length && key > parent.keys[i]) {
            i++;
        }
        
        parent.keys.splice(i, 0, key);
        parent.children.splice(i + 1, 0, rightChild);
        
        // Check if parent needs splitting
        if (parent.keys.length > this.order - 1) {
            this.splitInternal(parent);
        }
    }

    splitInternal(node) {
        const mid = Math.floor(this.order / 2);
        
        // Create new internal node
        const newNode = new BPlusNode(false);
        const promoteKey = node.keys[mid];
        
        // Move keys and children
        newNode.keys = node.keys.splice(mid + 1);
        newNode.children = node.children.splice(mid + 1);
        node.keys.splice(mid, 1); // Remove promoted key
        
        // Update parent pointers
        newNode.children.forEach(child => {
            child.parent = newNode;
        });
        
        // Insert into parent or create new root
        if (node.parent === null) {
            const newRoot = new BPlusNode(false);
            newRoot.keys.push(promoteKey);
            newRoot.children.push(node, newNode);
            node.parent = newRoot;
            newNode.parent = newRoot;
            this.root = newRoot;
        } else {
            this.insertIntoParent(node, promoteKey, newNode);
        }
    }

    search(key, path = []) {
        let current = this.root;
        path.push(current);
        
        // Navigate to leaf
        while (!current.isLeaf) {
            let i = 0;
            while (i < current.keys.length && key >= current.keys[i]) {
                i++;
            }
            current = current.children[i];
            path.push(current);
        }
        
        // Search in leaf
        const index = current.keys.indexOf(key);
        if (index !== -1) {
            return { found: true, path, node: current, index, data: current.data[index] };
        } else {
            return { found: false, path };
        }
    }

    rangeQuery(startKey, endKey) {
        let result = [];
        let current = this.firstLeaf;
        
        while (current !== null) {
            for (let i = 0; i < current.keys.length; i++) {
                if (current.keys[i] >= startKey && current.keys[i] <= endKey) {
                    result.push({ key: current.keys[i], data: current.data[i] });
                }
            }
            current = current.next;
        }
        
        return result;
    }

    delete(key) {
        const leaf = this.findLeaf(key);
        const keyIndex = leaf.keys.indexOf(key);
        
        if (keyIndex === -1) {
            return false; // Key not found
        }
        
        const deletedKey = leaf.keys[keyIndex];
        
        // Remove from leaf
        leaf.keys.splice(keyIndex, 1);
        leaf.data.splice(keyIndex, 1);
        
        // Handle rebalancing first
        const minKeys = Math.ceil((this.order - 1) / 2);
        if (leaf.keys.length < minKeys && leaf !== this.root) {
            this.rebalanceLeaf(leaf);
        } else if (leaf === this.root && leaf.keys.length === 0) {
            // Root is empty
            this.root = new BPlusNode(true);
            this.firstLeaf = this.root;
        }
        
        // Update internal nodes
        this.updateInternalNodesAfterDelete(deletedKey);
        
        this.updateVisualization();
        return true;
    }

    updateInternalNodesAfterDelete(deletedKey) {
        // Find replacement key
        let replacementKey = this.findReplacementKey(deletedKey);
        
        // Update internal nodes
        if (replacementKey !== null) {
            this.updateInternalNodeKey(this.root, deletedKey, replacementKey);
        } else {
            // Remove key from internal nodes
            this.removeKeyFromInternalNodes(this.root, deletedKey);
        }
    }

    findReplacementKey(deletedKey) {
        // Find next larger key
        let current = this.firstLeaf;
        let replacement = null;
        
        while (current) {
            for (let key of current.keys) {
                if (key > deletedKey && (replacement === null || key < replacement)) {
                    replacement = key;
                }
            }
            current = current.next;
        }
        
        // If no larger key found, find largest smaller key
        if (replacement === null) {
            current = this.firstLeaf;
            while (current) {
                for (let key of current.keys) {
                    if (key < deletedKey && (replacement === null || key > replacement)) {
                        replacement = key;
                    }
                }
                current = current.next;
            }
        }
        
        return replacement;
    }

    updateInternalNodeKey(node, oldKey, newKey) {
        if (!node || node.isLeaf) {
            return;
        }
        
        // Update key if found
        const keyIndex = node.keys.indexOf(oldKey);
        if (keyIndex !== -1) {
            node.keys[keyIndex] = newKey;
        }
        
        // Update child nodes
        if (node.children) {
            node.children.forEach(child => {
                this.updateInternalNodeKey(child, oldKey, newKey);
            });
        }
    }

    removeKeyFromInternalNodes(node, keyToRemove) {
        if (!node || node.isLeaf) {
            return;
        }
        
        // Remove key if found
        const keyIndex = node.keys.indexOf(keyToRemove);
        if (keyIndex !== -1) {
            node.keys.splice(keyIndex, 1);
            
            // Merge children that were separated by this key
            if (keyIndex < node.children.length - 1) {
                const leftChild = node.children[keyIndex];
                const rightChild = node.children[keyIndex + 1];
                
                // Merge leaf nodes
                if (leftChild.isLeaf && rightChild.isLeaf) {
                    leftChild.keys.push(...rightChild.keys);
                    leftChild.data.push(...rightChild.data);
                    leftChild.next = rightChild.next;
                    
                    // Remove right child
                    node.children.splice(keyIndex + 1, 1);
                } else if (!leftChild.isLeaf && !rightChild.isLeaf) {
                    // Merge internal nodes
                    if (rightChild.keys.length > 0) {
                        const promoteKey = rightChild.keys[0];
                        leftChild.keys.push(promoteKey);
                        leftChild.keys.push(...rightChild.keys.slice(1));
                        leftChild.children.push(...rightChild.children);
                        
                        // Update parent pointers
                        rightChild.children.forEach(child => child.parent = leftChild);
                        
                        // Remove right child
                        node.children.splice(keyIndex + 1, 1);
                    } else {
                        // Right child is empty
                        node.children.splice(keyIndex + 1, 1);
                    }
                } else {
                    // Different node types
                    node.children.splice(keyIndex + 1, 1);
                }
            }
            
            // Check if node needs rebalancing
            const minKeys = Math.ceil(this.order / 2) - 1;
            if (node.keys.length < minKeys && node !== this.root) {
                this.rebalanceInternal(node);
            } else if (node === this.root && node.keys.length === 0 && node.children.length === 1) {
                // Make child the new root
                this.root = node.children[0];
                this.root.parent = null;
            }
        }
        
        // Process child nodes
        if (node.children) {
            // Copy array to avoid issues during iteration
            const children = [...node.children];
            children.forEach(child => {
                this.removeKeyFromInternalNodes(child, keyToRemove);
            });
        }
    }

    rebalanceLeaf(leaf) {
        const parent = leaf.parent;
        if (!parent) return;
        
        const leafIndex = parent.children.indexOf(leaf);
        
        // Try to borrow from left sibling
        if (leafIndex > 0) {
            const leftSibling = parent.children[leafIndex - 1];
            const minKeys = Math.ceil((this.order - 1) / 2);
            
            if (leftSibling.keys.length > minKeys) {
                // Borrow from left
                const borrowKey = leftSibling.keys.pop();
                const borrowData = leftSibling.data.pop();
                
                leaf.keys.unshift(borrowKey);
                leaf.data.unshift(borrowData);
                
                // Update parent key
                if (leafIndex - 1 < parent.keys.length) {
                    parent.keys[leafIndex - 1] = leaf.keys[0];
                }
                return;
            }
        }
        
        // Try to borrow from right sibling
        if (leafIndex < parent.children.length - 1) {
            const rightSibling = parent.children[leafIndex + 1];
            const minKeys = Math.ceil((this.order - 1) / 2);
            
            if (rightSibling.keys.length > minKeys) {
                // Borrow from right
                const borrowKey = rightSibling.keys.shift();
                const borrowData = rightSibling.data.shift();
                
                leaf.keys.push(borrowKey);
                leaf.data.push(borrowData);
                
                // Update parent key
                if (leafIndex < parent.keys.length) {
                    parent.keys[leafIndex] = rightSibling.keys[0];
                }
                return;
            }
        }
        
        // Merge with sibling
        this.mergeLeaf(leaf, leafIndex);
    }

    mergeLeaf(leaf, leafIndex) {
        const parent = leaf.parent;
        
        if (leafIndex > 0) {
            // Merge with left sibling
            const leftSibling = parent.children[leafIndex - 1];
            leftSibling.keys.push(...leaf.keys);
            leftSibling.data.push(...leaf.data);
            leftSibling.next = leaf.next;
            
            // Remove from parent
            parent.keys.splice(leafIndex - 1, 1);
            parent.children.splice(leafIndex, 1);
        } else {
            // Merge with right sibling
            const rightSibling = parent.children[leafIndex + 1];
            leaf.keys.push(...rightSibling.keys);
            leaf.data.push(...rightSibling.data);
            leaf.next = rightSibling.next;
            
            // Remove from parent
            parent.keys.splice(leafIndex, 1);
            parent.children.splice(leafIndex + 1, 1);
        }
        
        // Check parent structure
        this.ensureNodeStructureValidity(parent);
        
        // Check if parent needs rebalancing
        const minKeys = Math.ceil(this.order / 2) - 1;
        if (parent.keys.length < minKeys && parent !== this.root) {
            this.rebalanceInternal(parent);
        } else if (parent === this.root && parent.keys.length === 0) {
            // Root is empty
            if (parent.children.length === 1) {
                this.root = parent.children[0];
                this.root.parent = null;
            } else if (parent.children.length === 0) {
                // Tree becomes empty
                this.root = new BPlusNode(true);
                this.firstLeaf = this.root;
            }
        }
    }

    // Check node structure is correct
    ensureNodeStructureValidity(node) {
        if (!node || node.isLeaf) return;
        
        // Internal node should have keys.length + 1 children
        const expectedChildren = node.keys.length + 1;
        
        // Remove excess children
        while (node.children.length > expectedChildren) {
            node.children.pop();
        }
    }

    rebalanceInternal(node) {
        const parent = node.parent;
        if (!parent) return;
        
        const nodeIndex = parent.children.indexOf(node);
        const minKeys = Math.ceil(this.order / 2) - 1;
        
        // Try borrowing from left sibling first
        if (nodeIndex > 0) {
            const leftSibling = parent.children[nodeIndex - 1];
            if (leftSibling.keys.length > minKeys) {
                // Borrow from left sibling
                const separatorKey = parent.keys[nodeIndex - 1];
                const borrowedKey = leftSibling.keys.pop();
                const borrowedChild = leftSibling.children.pop();
                
                node.keys.unshift(separatorKey);
                node.children.unshift(borrowedChild);
                borrowedChild.parent = node;
                
                parent.keys[nodeIndex - 1] = borrowedKey;
                return;
            }
        }
        
        // Try borrowing from right sibling
        if (nodeIndex < parent.children.length - 1) {
            const rightSibling = parent.children[nodeIndex + 1];
            if (rightSibling.keys.length > minKeys) {
                // Borrow from right sibling
                const separatorKey = parent.keys[nodeIndex];
                const borrowedKey = rightSibling.keys.shift();
                const borrowedChild = rightSibling.children.shift();
                
                node.keys.push(separatorKey);
                node.children.push(borrowedChild);
                borrowedChild.parent = node;
                
                parent.keys[nodeIndex] = borrowedKey;
                return;
            }
        }
        
        // Merge with sibling
        if (nodeIndex > 0) {
            // Merge with left sibling
            const leftSibling = parent.children[nodeIndex - 1];
            const separatorKey = parent.keys[nodeIndex - 1];
            
            leftSibling.keys.push(separatorKey, ...node.keys);
            leftSibling.children.push(...node.children);
            
            // Update parent pointers
            node.children.forEach(child => child.parent = leftSibling);
            
            // Remove from parent
            parent.keys.splice(nodeIndex - 1, 1);
            parent.children.splice(nodeIndex, 1);
        } else {
            // Merge with right sibling
            const rightSibling = parent.children[nodeIndex + 1];
            const separatorKey = parent.keys[nodeIndex];
            
            node.keys.push(separatorKey, ...rightSibling.keys);
            node.children.push(...rightSibling.children);
            
            // Update parent pointers
            rightSibling.children.forEach(child => child.parent = node);
            
            // Remove from parent
            parent.keys.splice(nodeIndex, 1);
            parent.children.splice(nodeIndex + 1, 1);
        }
        
        // Ensure parent structure is valid
        this.ensureNodeStructureValidity(parent);
        
        // Check parent recursively
        if (parent.keys.length < minKeys && parent !== this.root) {
            this.rebalanceInternal(parent);
        } else if (parent === this.root && parent.keys.length === 0) {
            // Root is empty
            if (parent.children.length === 1) {
                this.root = parent.children[0];
                this.root.parent = null;
            } else if (parent.children.length === 0) {
                // Tree becomes empty
                this.root = new BPlusNode(true);
                this.firstLeaf = this.root;
            }
        }
    }
}