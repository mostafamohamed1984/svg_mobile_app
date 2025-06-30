# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, add_to_date, get_datetime, date_diff
import hashlib
import secrets
import string
import re
from cryptography.fernet import Fernet
import base64


class RemoteAccess(Document):
	def before_save(self):
		"""Handle password encryption and expiration logic before saving"""
		self.handle_password_security()
		self.handle_expiration_logic()
		self.validate_password_complexity()
	
	def after_save(self):
		"""Handle post-save operations"""
		self.send_assignment_notifications()
	
	def handle_password_security(self):
		"""Handle password encryption and security tracking"""
		if self.password and not self.password_encrypted:
			# Encrypt password
			self.password = self.encrypt_password(self.password)
			self.password_encrypted = 1
			self.password_last_changed = now_datetime()
			self.password_generation_algorithm = "AES-256"
			
		# Update password history count
		if self.has_value_changed('password'):
			self.password_history_count = (self.password_history_count or 0) + 1
	
	def handle_expiration_logic(self):
		"""Handle automatic expiration settings"""
		# Set expiration datetime for Temporary/Reserved status
		if self.status in ['Temporary', 'Reserved'] and not self.expiration_datetime:
			hours_to_add = 24 if self.status == 'Temporary' else 168  # 24h for Temporary, 7 days for Reserved
			self.expiration_datetime = add_to_date(now_datetime(), hours=hours_to_add)
			self.expiration_reminder_sent = 0
		
		# Clear expiration when status changes to Available
		elif self.status == 'Available':
			self.expiration_datetime = None
			self.expiration_reminder_sent = 0
			self.assign_to = None
			self.user = None
	
	def validate_password_complexity(self):
		"""Validate password meets complexity requirements"""
		if not self.password or self.password_encrypted:
			return
			
		complexity_rules = self.get_password_complexity_rules()
		score = 0
		
		if len(self.password) >= complexity_rules.get('min_length', 8):
			score += 1
		if re.search(r'[A-Z]', self.password):
			score += 1
		if re.search(r'[a-z]', self.password):
			score += 1
		if re.search(r'\d', self.password):
			score += 1
		if re.search(r'[!@#$%^&*(),.?":{}|<>]', self.password):
			score += 1
			
		self.password_complexity_level = score
		
		if score < complexity_rules.get('min_complexity', 3):
			frappe.throw(f"Password does not meet complexity requirements. Score: {score}/5")
	
	def encrypt_password(self, password):
		"""Encrypt password using Fernet encryption"""
		try:
			# Get or create encryption key
			key = self.get_encryption_key()
			fernet = Fernet(key)
			encrypted_password = fernet.encrypt(password.encode())
			return base64.b64encode(encrypted_password).decode()
		except Exception as e:
			frappe.log_error(f"Password encryption failed: {str(e)}")
			return password
	
	def decrypt_password(self):
		"""Decrypt password for display/use"""
		if not self.password_encrypted or not self.password:
			return self.password
			
		try:
			key = self.get_encryption_key()
			fernet = Fernet(key)
			encrypted_data = base64.b64decode(self.password.encode())
			decrypted_password = fernet.decrypt(encrypted_data).decode()
			return decrypted_password
		except Exception as e:
			frappe.log_error(f"Password decryption failed: {str(e)}")
			return "***ENCRYPTED***"
	
	def get_encryption_key(self):
		"""Get or create encryption key for password encryption"""
		key_doc = frappe.get_single("System Settings")
		if not hasattr(key_doc, 'remote_access_encryption_key') or not key_doc.remote_access_encryption_key:
			# Generate new key
			key = Fernet.generate_key()
			frappe.db.set_single_value("System Settings", "remote_access_encryption_key", key.decode())
			frappe.db.commit()
			return key
		return key_doc.remote_access_encryption_key.encode()
	
	def get_password_complexity_rules(self):
		"""Get password complexity rules from settings"""
		# You can create a separate DocType for these settings
		return {
			'min_length': 8,
			'min_complexity': 3,
			'require_uppercase': True,
			'require_lowercase': True,
			'require_numbers': True,
			'require_special': True
		}
	
	def send_assignment_notifications(self):
		"""Send email notifications for assignments"""
		if self.has_value_changed('assign_to') and self.assign_to:
			self.send_assignment_email()
		
		if self.has_value_changed('status') and self.status == 'Expired':
			self.send_expiration_email()
	
	def send_assignment_email(self):
		"""Send email notification when remote access is assigned"""
		if not self.assign_to:
			return
			
		employee = frappe.get_doc("Employee", self.assign_to)
		if not employee.user_id:
			return
			
		user = frappe.get_doc("User", employee.user_id)
		
		# Get decrypted password for email
		password = self.decrypt_password()
		
		subject = f"Remote Access Assigned: {self.id}"
		message = f"""
		Dear {employee.employee_name},
		
		You have been assigned remote access to device: {self.id}
		Status: {self.status}
		Password: {password}
		App Type: {self.app_type}
		
		Expiration: {self.expiration_datetime if self.expiration_datetime else 'No expiration set'}
		
		Manual Instructions:
		1. Open {self.app_type or 'RustDesk/AnyDesk'}
		2. Enter Device ID: {self.id}
		3. Enter Password: {password}
		4. Click Connect
		
		Please report any issues to IT support.
		
		Best regards,
		IT Team
		"""
		
		frappe.sendmail(
			recipients=[user.email],
			subject=subject,
			message=message,
			reference_doctype=self.doctype,
			reference_name=self.name
		)
	
	def send_expiration_email(self):
		"""Send email notification when access expires"""
		subject = f"Remote Access Expired: {self.id}"
		message = f"""
		Remote access for device {self.id} has expired.
		
		Previous Assignment: {self.assign_to}
		Status changed to: {self.status}
		Expired at: {now_datetime()}
		
		The device is now available for new assignments.
		"""
		
		# Send to IT administrators
		it_users = frappe.get_all("User", filters={"role_profile_name": "System Manager"}, fields=["email"])
		recipients = [user.email for user in it_users if user.email]
		
		if recipients:
			frappe.sendmail(
				recipients=recipients,
				subject=subject,
				message=message,
				reference_doctype=self.doctype,
				reference_name=self.name
			)
	
	@staticmethod
	def generate_secure_password(length=12, algorithm="secure_random"):
		"""Generate secure password with different algorithms"""
		if algorithm == "secure_random":
			# Use cryptographically secure random
			alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
			return ''.join(secrets.choice(alphabet) for _ in range(length))
		
		elif algorithm == "pronounceable":
			# Generate more pronounceable password
			consonants = "bcdfghjklmnpqrstvwxyz"
			vowels = "aeiou"
			password = ""
			for i in range(length // 2):
				password += secrets.choice(consonants) + secrets.choice(vowels)
			# Add numbers and special chars
			password += str(secrets.randbelow(100))
			password += secrets.choice("!@#$%")
			return password[:length]
		
		elif algorithm == "passphrase":
			# Generate passphrase-style password
			words = ["apple", "bridge", "cloud", "dream", "eagle", "forest", "galaxy", "harbor"]
			selected_words = [secrets.choice(words) for _ in range(3)]
			return "-".join(selected_words) + str(secrets.randbelow(100))
		
		else:
			# Default fallback
			return RemoteAccess.generate_secure_password(length, "secure_random")


@frappe.whitelist()
def check_expired_access():
	"""Scheduled function to check and expire remote access"""
	current_time = now_datetime()
	
	# Find expired records
	expired_records = frappe.get_all(
		"Remote Access",
		filters={
			"status": ["in", ["Temporary", "Reserved"]],
			"expiration_datetime": ["<=", current_time],
			"auto_expire": 1
		},
		fields=["name", "id", "assign_to", "expiration_datetime"]
	)
	
	for record in expired_records:
		doc = frappe.get_doc("Remote Access", record.name)
		doc.status = "Expired"
		doc.last_expiration_check = current_time
		doc.save()
		
		# Create log entry
		create_expiration_log(doc)
	
	# Send reminder notifications
	send_expiration_reminders()
	
	return f"Processed {len(expired_records)} expired records"


@frappe.whitelist()
def send_expiration_reminders():
	"""Send reminder emails for upcoming expirations"""
	# Find records expiring soon
	reminder_records = frappe.db.sql("""
		SELECT name, id, assign_to, expiration_datetime, expiration_notification_hours
		FROM `tabRemote Access`
		WHERE status IN ('Temporary', 'Reserved')
		AND expiration_datetime IS NOT NULL
		AND expiration_reminder_sent = 0
		AND TIMESTAMPDIFF(HOUR, NOW(), expiration_datetime) <= expiration_notification_hours
		AND TIMESTAMPDIFF(HOUR, NOW(), expiration_datetime) > 0
	""", as_dict=True)
	
	for record in reminder_records:
		doc = frappe.get_doc("Remote Access", record.name)
		send_expiration_reminder_email(doc)
		
		# Mark reminder as sent
		frappe.db.set_value("Remote Access", record.name, "expiration_reminder_sent", 1)
	
	frappe.db.commit()
	return f"Sent {len(reminder_records)} reminder emails"


def send_expiration_reminder_email(doc):
	"""Send expiration reminder email"""
	if not doc.assign_to:
		return
		
	employee = frappe.get_doc("Employee", doc.assign_to)
	if not employee.user_id:
		return
		
	user = frappe.get_doc("User", employee.user_id)
	hours_remaining = date_diff(doc.expiration_datetime, now_datetime()) * 24
	
	subject = f"Remote Access Expiring Soon: {doc.id}"
	message = f"""
	Dear {employee.employee_name},
	
	Your remote access assignment is expiring soon:
	
	Device ID: {doc.id}
	Expires: {doc.expiration_datetime}
	Hours Remaining: {hours_remaining:.1f}
	
	Please complete your work and report usage before expiration.
	Contact IT if you need an extension.
	
	Best regards,
	IT Team
	"""
	
	frappe.sendmail(
		recipients=[user.email],
		subject=subject,
		message=message,
		reference_doctype=doc.doctype,
		reference_name=doc.name
	)


def create_expiration_log(doc):
	"""Create log entry when access expires"""
	log_doc = frappe.get_doc({
		"doctype": "Remote Access Log",
		"reference": doc.name,
		"id": doc.id,
		"old_password": doc.password,
		"new_password": "",
		"status": "Expired",
		"assign_to": doc.assign_to,
		"user": doc.user,
		"company": doc.company,
		"password_applied": 0,
		"connection_notes": "Automatically expired due to time limit"
	})
	log_doc.insert()
	frappe.db.commit()
